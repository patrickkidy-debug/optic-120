import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pino from 'pino';
import QRCode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { SYSTEM_PROMPT } from './prompt.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Charge whatsapp-agent/.env s'il existe (dev local). En prod : variables du serveur.
try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch {
  /* pas de .env : on lit process.env */
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
// Dossier de session (à pointer vers un volume persistant en prod, ex. /data/auth).
const AUTH_DIR = process.env.AUTH_DIR || path.join(__dirname, 'auth');
const PORT = process.env.PORT || 3000;
// Clé d'accès à la page de scan du QR (protège le lien public).
const DASHBOARD_KEY = process.env.DASHBOARD_KEY || 'oculo';
const HISTORY_LIMIT = 24;

if (!ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY manquant.');
  process.exit(1);
}

/** Mémoire de conversation par contact (en mémoire vive). */
const histories = new Map();

/** État partagé avec la page web (scan QR + statut). */
const statusState = { connected: false, qrDataUrl: null, lastConnectedAt: null };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Impose l'alternance user/assistant démarrant par user (exigence API Claude). */
function normalize(turns) {
  const out = [];
  for (const t of turns) {
    const content = (t.content || '').trim();
    if (!content) continue;
    const last = out[out.length - 1];
    if (last && last.role === t.role) last.content += `\n${content}`;
    else out.push({ role: t.role, content });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

/** Interroge Claude et renvoie la réponse (repli sûr en cas d'erreur). */
async function askClaude(history) {
  const messages = normalize(history);
  if (!messages.length) return 'Bonjour 👋 Comment puis-je vous aider ?';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 600, system: SYSTEM_PROMPT, messages }),
    });
    if (!res.ok) {
      console.error('Anthropic', res.status, (await res.text()).slice(0, 300));
      return 'Merci pour votre message 🙏 Un conseiller OculoSaaS vous répond très vite.';
    }
    const data = await res.json();
    const text = (data.content || [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text || '')
      .join('')
      .trim();
    return text || 'Merci pour votre message 🙏 Un conseiller OculoSaaS vous répond très vite.';
  } catch (err) {
    console.error('Appel Claude échoué :', err?.message || err);
    return 'Merci pour votre message 🙏 Un conseiller OculoSaaS vous répond très vite.';
  }
}

function extractText(message) {
  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    ''
  );
}

async function handleMessage(sock, jid, text, name) {
  const history = histories.get(jid) || [];
  history.push({ role: 'user', content: text });

  try {
    await sock.presenceSubscribe(jid);
    await sock.sendPresenceUpdate('composing', jid);
  } catch {
    /* ignore */
  }

  const reply = await askClaude(history);
  await sleep(Math.min(5000, Math.max(1200, reply.length * 35))); // délai « humain »

  history.push({ role: 'assistant', content: reply });
  histories.set(jid, history.slice(-HISTORY_LIMIT));

  try {
    await sock.sendPresenceUpdate('paused', jid);
  } catch {
    /* ignore */
  }
  await sock.sendMessage(jid, { text: reply });
  console.log(`↩️  Réponse envoyée à ${name || jid} (${reply.length} car.)`);
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      statusState.qrDataUrl = await QRCode.toDataURL(qr, { width: 420, margin: 2 });
      statusState.connected = false;
      qrcodeTerminal.generate(qr, { small: true });
      console.log(`\n📲 QR prêt — ouvre la page de scan : /?key=${DASHBOARD_KEY}\n`);
    }
    if (connection === 'open') {
      statusState.connected = true;
      statusState.qrDataUrl = null;
      statusState.lastConnectedAt = new Date().toISOString();
      console.log('✅ CONNECTED — agent OculoSaaS en ligne, il répond aux prospects.');
    }
    if (connection === 'close') {
      statusState.connected = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      console.log(`⚠️  Connexion fermée (code ${code}).`, loggedOut ? 'Déconnecté.' : 'Reconnexion…');
      if (!loggedOut) start();
      else console.log('Session déconnectée : rescanne le QR sur la page web.');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      try {
        if (!msg.message || msg.key.fromMe) continue;
        const jid = msg.key.remoteJid || '';
        // 1:1 uniquement : accepte @s.whatsapp.net ET @lid ; exclut groupes/statuts/diffusions.
        if (
          jid.endsWith('@g.us') ||
          jid.endsWith('@newsletter') ||
          jid.endsWith('@broadcast') ||
          jid === 'status@broadcast'
        ) {
          continue;
        }
        const text = extractText(msg.message).trim();
        if (!text) continue;
        const name = msg.pushName;
        console.log(`📥 Message de ${name || jid} : ${text.slice(0, 80)}`);
        await handleMessage(sock, jid, text, name);
      } catch (err) {
        console.error('Erreur traitement message :', err?.message || err);
      }
    }
  });
}

/* ---------- Page web : scan du QR + statut (indispensable sur un serveur) ---------- */
http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === '/health') {
      res.writeHead(200).end('ok');
      return;
    }
    if (url.searchParams.get('key') !== DASHBOARD_KEY) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' }).end('Accès refusé (clé invalide).');
      return;
    }
    const body = statusState.connected
      ? `<div class="ok">✅ Agent connecté et en ligne</div>
         <p>Ton bot WhatsApp répond aux prospects. Tu peux fermer cette page.</p>
         <p class="muted">Connecté depuis : ${statusState.lastConnectedAt || '—'}</p>`
      : statusState.qrDataUrl
        ? `<h2>Scanne ce QR avec WhatsApp</h2>
           <p>WhatsApp → Réglages → Appareils connectés → Connecter un appareil</p>
           <img src="${statusState.qrDataUrl}" alt="QR" />
           <p class="muted">La page se rafraîchit automatiquement.</p>`
        : `<div class="muted">Démarrage… le QR va apparaître dans quelques secondes.</div>`;
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(
      `<!doctype html><html lang="fr"><head><meta charset="utf-8">
       <meta name="viewport" content="width=device-width,initial-scale=1">
       <title>Agent WhatsApp OculoSaaS</title>
       <meta http-equiv="refresh" content="8">
       <style>body{font-family:system-ui,sans-serif;text-align:center;padding:30px;background:#0f172a;color:#e2e8f0}
       img{max-width:340px;width:80%;background:#fff;padding:12px;border-radius:14px}
       .ok{font-size:22px;color:#22c55e;font-weight:700;margin:20px}
       .muted{color:#94a3b8}h2{color:#a78bfa}</style></head>
       <body><h1>🤖 Agent WhatsApp OculoSaaS</h1>${body}</body></html>`,
    );
  })
  .listen(PORT, () => console.log(`🌐 Page de scan : http://localhost:${PORT}/?key=${DASHBOARD_KEY}`));

start().catch((err) => {
  console.error('Échec démarrage agent :', err);
  process.exit(1);
});
