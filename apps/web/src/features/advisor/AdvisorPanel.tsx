import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Keyboard, Mic, MicOff, PhoneCall, RotateCcw, Send, Trash2, Volume2, VolumeX, X, MessageCircle, ScrollText } from 'lucide-react';
import clsx from 'clsx';
import { ADVISOR_CONV_KEY, deleteConversation, requestCallback, sendEvent, startConversation, streamReply, type Turn, type UiEvent } from './api';
import { canRecognize, canSpeak, VoiceEngine } from './voice';
import { advisorStrings } from './strings';

/** Palette claire épinglée : le panneau reste blanc premium quel que soit le thème. */
const THEME = {
  '--bg': '#ffffff', '--surface': '#ffffff', '--surface-2': '#f4f6fb', '--surface-2-rgb': '244 246 251',
  '--border': 'rgba(15, 23, 42, 0.08)', '--border-strong': 'rgba(15, 23, 42, 0.14)',
  '--primary': '#7c3aed', '--primary-rgb': '124 58 237', '--accent': '#ea580c', '--accent-rgb': '234 88 12',
  '--text': '#0f172a', '--text-rgb': '15 23 42', '--text-muted': '#4a5568', '--text-muted-rgb': '74 85 104',
  '--text-faint': '#94a3b8', '--success': '#15803d', '--success-rgb': '21 128 61', '--danger': '#dc2626', '--danger-rgb': '220 38 38',
  '--gradient-brand': 'linear-gradient(120deg, #7c3aed 0%, #ec4899 50%, #f97316 100%)', colorScheme: 'light',
} as CSSProperties;

type Phase = 'consent' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'idle' | 'ended' | 'error';
type Msg = Turn & { cards?: UiEvent[] };

/** Texte brut : retire le gras markdown que le modèle laisserait passer. */
const plain = (t: string) => t.replace(/\*\*|__/g, '').replace(/^#+\s*/gm, '');

const ACTIVATION_TOKEN_KEY = 'oculo_activation_token';
const readToken = () => {
  try {
    return localStorage.getItem(ACTIVATION_TOKEN_KEY) ?? undefined;
  } catch {
    return undefined;
  }
};

/** Avatar : orbe de marque, anneaux selon l'état (parle / écoute / réfléchit). */
function Orb({ phase, level }: { phase: Phase; level: number }) {
  const reduce = useReducedMotion();
  const speaking = phase === 'speaking';
  const listening = phase === 'listening';
  return (
    <div className="relative grid h-36 w-36 place-items-center" aria-hidden>
      {!reduce && (speaking || listening) &&
        [0, 1, 2].map((i) => (
          <motion.span
            key={`${phase}-${i}`}
            className={clsx('absolute inset-0 rounded-full', speaking ? 'bg-[#ec4899]/20' : 'border-2 border-success/50')}
            initial={{ scale: 0.8, opacity: 0.7 }}
            animate={{ scale: speaking ? 1.5 + level * 0.2 : 1.35, opacity: 0 }}
            transition={{ duration: speaking ? 1.4 : 1.8, repeat: Infinity, delay: i * (speaking ? 0.45 : 0.6), ease: 'easeOut' }}
          />
        ))}
      <motion.div
        className="relative grid h-28 w-28 place-items-center overflow-hidden rounded-full shadow-[0_24px_60px_-16px_rgba(236,72,153,0.6)]"
        style={{ background: 'var(--gradient-brand)' }}
        animate={reduce ? undefined : phase === 'thinking' ? { rotate: 360 } : { scale: speaking ? [1, 1.06, 0.98, 1.04, 1] : 1 }}
        transition={phase === 'thinking' ? { duration: 2.4, repeat: Infinity, ease: 'linear' } : { duration: 1.1, repeat: speaking ? Infinity : 0 }}
      >
        <svg viewBox="0 0 24 24" className="h-12 w-12 text-white" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
          <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        {listening && <span className="absolute bottom-3 h-2 w-2 rounded-full bg-white live-dot" />}
      </motion.div>
    </div>
  );
}

export function AdvisorPanel({ open, onClose, page }: { open: boolean; onClose: () => void; page: string }) {
  const { lang, s } = advisorStrings(document.documentElement.lang || navigator.language || 'fr');
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('consent');
  const [mode, setMode] = useState<'VOICE' | 'TEXT'>('VOICE');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [live, setLive] = useState('');
  const [interim, setInterim] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [tts, setTts] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [input, setInput] = useState('');
  const [demo, setDemo] = useState<Extract<UiEvent, { kind: 'demo' }>['data'] | null>(null);
  const [callback, setCallback] = useState<'closed' | 'open' | 'sent'>('closed');
  const [hasConv, setHasConv] = useState(false);

  const convId = useRef<string | null>(null);
  const engine = useRef<VoiceEngine | null>(null);
  const abort = useRef<AbortController | null>(null);
  const history = useRef<Msg[]>([]);
  const queued = useRef('');
  const sendTimer = useRef<number>();
  const lastActivity = useRef(Date.now());
  const ended = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  const setHistory = (m: Msg[]) => {
    history.current = m;
    setMsgs(m);
  };

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, live, interim]);

  /* ---------- Envoi d'un tour ---------- */
  const ask = useCallback(
    async (text: string) => {
      const id = convId.current;
      if (!id || !text.trim()) return;
      abort.current?.abort();
      engine.current?.stopSpeaking();
      lastActivity.current = Date.now();
      setError('');
      const next: Msg[] = [...history.current, { role: 'user', content: text.trim() }];
      setHistory(next);
      setPhase('thinking');
      setLive('');
      const ctrl = new AbortController();
      abort.current = ctrl;
      let answer = '';
      const cards: UiEvent[] = [];
      try {
        await streamReply(
          id,
          next.map(({ role, content }) => ({ role, content })),
          {
            text: (d) => {
              answer += d;
              setLive(answer);
              if (engine.current && tts) {
                engine.current.feed(d);
                if (engine.current.isSpeaking) setPhase('speaking');
              }
            },
            ui: (e) => {
              cards.push(e);
              if (e.kind === 'demo') setDemo(e.data);
            },
            limit: () => setNotice(s.limitReached),
          },
          ctrl.signal,
        );
        engine.current?.flush();
        setHistory([...next, { role: 'assistant', content: answer, cards }]);
        setLive('');
        if (!engine.current?.isSpeaking) setPhase(mode === 'VOICE' && micOn ? 'listening' : 'idle');
      } catch {
        if (ctrl.signal.aborted) {
          // Interrompu par le visiteur : on garde ce qui a déjà été dit.
          if (answer.trim()) setHistory([...next, { role: 'assistant', content: `${answer} …`, cards }]);
          setLive('');
          return;
        }
        setLive('');
        setError(navigator.onLine ? s.errServer : s.errNetwork);
        setPhase('error');
      }
    },
    [mode, micOn, s, tts],
  );

  // Les gestionnaires vocaux sont créés une fois : ils appellent toujours la version courante.
  const askRef = useRef(ask);
  askRef.current = ask;

  /* ---------- Démarrage ---------- */
  async function start(m: 'VOICE' | 'TEXT') {
    setMode(m);
    setError('');
    setPhase('connecting');
    const voiceOk = m === 'VOICE' && canRecognize();
    try {
      const r = await startConversation({ page, mode: voiceOk ? 'VOICE' : 'TEXT', lang, activationToken: readToken() });
      convId.current = r.id;
      setHasConv(true);
      ended.current = false;
      try {
        localStorage.setItem(ADVISOR_CONV_KEY, r.id);
      } catch {
        /* stockage indisponible */
      }
    } catch (e) {
      setError((e as Error).message === 'quota' ? s.errQuota : s.errUnavailable);
      setPhase('error');
      return;
    }
    const greeting: Msg = { role: 'assistant', content: s.greeting };
    setHistory([greeting]);

    if (m === 'VOICE' && !voiceOk) {
      setMode('TEXT');
      setNotice(s.errUnsupported);
      sendEvent(convId.current!, 'voice_unsupported');
    }
    const eng = new VoiceEngine(lang, {
      onInterim: (t) => setInterim(t),
      onFinal: (t) => {
        lastActivity.current = Date.now();
        queued.current = `${queued.current} ${t}`.trim();
        window.clearTimeout(sendTimer.current);
        // Laisse finir la phrase : on attend un court silence avant d'envoyer.
        sendTimer.current = window.setTimeout(() => {
          const text = queued.current;
          queued.current = '';
          void askRef.current(text);
        }, 900);
      },
      onBargeIn: () => {
        abort.current?.abort();
        setPhase('listening');
      },
      onSpeakingChange: (sp) => {
        if (sp) setPhase('speaking');
        else setPhase((p) => (p === 'speaking' ? (eng.isListening ? 'listening' : 'idle') : p));
      },
      onError: (code) => {
        if (code === 'not-allowed' || code === 'no-device' || code === 'unsupported') {
          setMicOn(false);
          setMode('TEXT');
          setNotice(code === 'not-allowed' ? s.errMic : code === 'no-device' ? s.errNoDevice : s.errUnsupported);
          sendEvent(convId.current!, code === 'not-allowed' ? 'mic_denied' : 'voice_unsupported');
          setPhase('idle');
        } else if (code === 'network') setNotice(s.errNetwork);
      },
    });
    eng.ttsEnabled = canSpeak() && (voiceOk || tts);
    if (!voiceOk) eng.ttsEnabled = false;
    engine.current = eng;
    if (voiceOk) {
      setTts(true);
      eng.say(s.greeting);
      setPhase('speaking');
      eng.startListening();
    } else {
      setTts(false);
      setPhase('idle');
    }
  }

  /* ---------- Silence prolongé : on met l'écoute en pause ---------- */
  useEffect(() => {
    if (phase !== 'listening') return;
    const id = window.setInterval(() => {
      if (Date.now() - lastActivity.current > 45_000 && engine.current?.isListening) {
        engine.current.stopListening();
        setMicOn(false);
        setPhase('idle');
      }
    }, 5000);
    return () => window.clearInterval(id);
  }, [phase]);

  function toggleMic() {
    const eng = engine.current;
    if (!eng) return;
    if (micOn) {
      eng.stopListening();
      setMicOn(false);
      if (phase === 'listening') setPhase('idle');
    } else {
      if (!canRecognize()) return setNotice(s.errUnsupported);
      lastActivity.current = Date.now();
      setMode('VOICE');
      eng.ttsEnabled = canSpeak() && tts;
      eng.startListening();
      setMicOn(true);
      if (phase === 'idle') setPhase('listening');
    }
  }

  function toggleTts() {
    const v = !tts;
    setTts(v);
    if (engine.current) {
      engine.current.ttsEnabled = v && canSpeak();
      if (!v) engine.current.stopSpeaking();
    }
  }

  function repeat() {
    const last = [...history.current].reverse().find((m) => m.role === 'assistant');
    if (last && engine.current && canSpeak()) {
      engine.current.ttsEnabled = true;
      setTts(true);
      engine.current.say(last.content);
    }
  }

  function stopAll() {
    abort.current?.abort();
    window.clearTimeout(sendTimer.current);
    engine.current?.destroy();
    engine.current = null;
  }

  function end() {
    if (convId.current && !ended.current) sendEvent(convId.current, 'ended');
    ended.current = true;
    stopAll();
    setPhase('ended');
  }

  function close() {
    // Fermé sans « Terminer » après au moins un échange : conversation abandonnée.
    if (convId.current && !ended.current && history.current.some((m) => m.role === 'user')) sendEvent(convId.current, 'abandoned', true);
    ended.current = true;
    stopAll();
    onClose();
  }

  useEffect(() => {
    const onUnload = () => {
      if (convId.current && !ended.current && history.current.some((m) => m.role === 'user')) sendEvent(convId.current, 'abandoned', true);
    };
    window.addEventListener('pagehide', onUnload);
    return () => {
      window.removeEventListener('pagehide', onUnload);
      stopAll();
    };
  }, []);

  function goSignup(url: string) {
    if (convId.current) sendEvent(convId.current, 'signup_clicked', true);
    ended.current = true;
    stopAll();
    onClose();
    navigate(url);
  }

  async function wipe() {
    if (convId.current && (await deleteConversation(convId.current).catch(() => false))) {
      try {
        localStorage.removeItem(ADVISOR_CONV_KEY);
      } catch {
        /* rien */
      }
      convId.current = null;
      setHistory([]);
      setNotice(s.deleted);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const t = input.trim();
    if (!t) return;
    setInput('');
    if (mode === 'VOICE' && !micOn) {
      setMode('TEXT');
      if (convId.current) sendEvent(convId.current, 'switched_to_text');
    }
    void ask(t);
  }

  const status: Record<Phase, string> = {
    consent: '',
    connecting: s.connecting,
    listening: s.listening,
    thinking: s.thinking,
    speaking: s.speaking,
    idle: micOn ? s.idle : mode === 'VOICE' ? s.paused : '',
    ended: s.ended,
    error: '',
  };
  const lastCards = msgs.flatMap((m) => m.cards ?? []);
  const plans = [...lastCards].reverse().find((c) => c.kind === 'plans') as Extract<UiEvent, { kind: 'plans' }> | undefined;
  const signup = [...lastCards].reverse().find((c) => c.kind === 'signup') as Extract<UiEvent, { kind: 'signup' }> | undefined;
  const human = lastCards.some((c) => c.kind === 'human');
  const fmt = (n: number) => new Intl.NumberFormat(lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-PT' : 'fr-FR').format(n);

  // Portail sur <body> : le panneau passe au-dessus de tout, quel que soit l'empilement de la page.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-end bg-[#0f172a]/40 backdrop-blur-sm sm:items-stretch"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={s.title}
            style={THEME}
            className="flex h-[100dvh] w-full flex-col bg-white text-content shadow-2xl sm:h-full sm:max-w-[440px]"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          >
            {/* En-tête */}
            <header className="flex items-center gap-3 border-b border-line px-5 py-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-white">
                <MessageCircle className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-base font-extrabold">{s.title}</div>
                <div className="text-xs font-semibold uppercase tracking-wide text-primary">{s.subtitle}</div>
              </div>
              {phase !== 'consent' && phase !== 'ended' && (
                <button type="button" onClick={end} className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:bg-surface-2">
                  {s.end}
                </button>
              )}
              <button type="button" onClick={close} aria-label={s.close} className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2">
                <X className="h-5 w-5" />
              </button>
            </header>

            {phase === 'consent' ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-8 text-center">
                <Orb phase="idle" level={0} />
                <h2 className="font-display text-2xl font-extrabold">{s.consentTitle}</h2>
                <div className="space-y-3 text-sm leading-relaxed text-content-muted">
                  <p>{s.consent1}</p>
                  <p>{s.consent2}</p>
                  <p className="font-semibold text-content">{s.consent3}</p>
                </div>
                <button type="button" onClick={() => void start('VOICE')} className="btn-primary w-full rounded-full py-4 text-base">
                  <Mic className="h-5 w-5" /> {s.startVoice}
                </button>
                <button type="button" onClick={() => void start('TEXT')} className="inline-flex items-center gap-2 text-sm font-semibold text-content-muted hover:text-primary">
                  <Keyboard className="h-4 w-4" /> {s.startText}
                </button>
              </div>
            ) : (
              <>
                {/* Scène : avatar, état, démonstration */}
                <div className="flex flex-col items-center gap-2 border-b border-line bg-gradient-to-b from-[#faf7ff] to-white px-5 pb-4 pt-5">
                  {demo ? (
                    <figure className="w-full">
                      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-card">
                        {demo.kind === 'video' ? (
                          <video src={demo.src} controls muted playsInline className="block w-full" />
                        ) : (
                          <img src={demo.src} alt={demo.title} className="block max-h-[34vh] w-full object-contain" />
                        )}
                        <button type="button" onClick={() => setDemo(null)} aria-label={s.close} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 shadow">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <figcaption className="mt-2 text-center text-xs font-semibold text-content-muted">{demo.title}</figcaption>
                    </figure>
                  ) : (
                    <Orb phase={phase} level={0.5} />
                  )}
                  <p className="min-h-[1.5rem] text-center text-sm font-semibold text-content-muted" aria-live="polite">
                    {interim ? `${s.you} : « ${interim} »` : status[phase]}
                  </p>
                  {(phase === 'error' || notice) && (
                    <div role="alert" className="w-full rounded-xl bg-amber-50 px-3 py-2 text-center text-sm text-amber-900">
                      {phase === 'error' ? error : notice}
                      {phase === 'error' && !hasConv && (
                        <a href="https://wa.me/221768881739" target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center justify-center gap-2 font-bold text-success">
                          <MessageCircle className="h-4 w-4" /> {s.whatsapp}
                        </a>
                      )}
                      {phase === 'error' && msgs.some((m) => m.role === 'user') && (
                        <button
                          type="button"
                          className="ml-2 font-bold underline"
                          onClick={() => {
                            const lastUser = [...history.current].reverse().find((m) => m.role === 'user');
                            if (lastUser) {
                              setHistory(history.current.slice(0, history.current.lastIndexOf(lastUser)));
                              void ask(lastUser.content);
                            }
                          }}
                        >
                          {s.retry}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Transcription et cartes */}
                <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                  {(showTranscript || mode === 'TEXT') &&
                    msgs.map((m, i) => (
                      <div key={i} className={clsx('max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed', m.role === 'user' ? 'ml-auto bg-primary text-white' : 'bg-surface-2 text-content')}>
                        {plain(m.content)}
                      </div>
                    ))}
                  {(showTranscript || mode === 'TEXT') && live && <div className="max-w-[88%] rounded-2xl bg-surface-2 px-4 py-2.5 text-sm leading-relaxed">{plain(live)}</div>}
                  {/* Sous-titres en mode vocal : ce que dit le conseiller, lisible sans le son. */}
                  {!showTranscript && mode === 'VOICE' && (live || msgs.some((m) => m.role === 'assistant')) && (
                    <p className="px-2 text-center font-display text-lg font-semibold leading-snug text-content">
                      {plain(live || [...msgs].reverse().find((m) => m.role === 'assistant')?.content || '')}
                    </p>
                  )}

                  {plans && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wide text-content-muted">{s.plansTitle}</div>
                      {plans.data.plans.map((p) => (
                        <div key={p.code} className={clsx('rounded-2xl border p-4', signup?.data.planName === p.name ? 'border-primary bg-primary/5' : 'border-line')}>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-display font-extrabold">{p.name}</span>
                            <span className="font-display font-extrabold">
                              {fmt(p.priceMonthly)} {plans.data.currency} <span className="text-xs font-semibold text-content-muted">{s.perMonth}</span>
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-content-muted">
                            {s.stores(p.maxBranches)} · {s.users(p.maxUsers)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {human && (
                    <div className="space-y-2 rounded-2xl border border-line p-4">
                      <a
                        href="https://wa.me/221768881739"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => convId.current && sendEvent(convId.current, 'human_whatsapp_clicked')}
                        className="flex items-center gap-2 font-semibold text-success"
                      >
                        <MessageCircle className="h-4 w-4" /> {s.whatsapp}
                      </a>
                      {callback === 'sent' ? (
                        <p className="text-sm text-success">{s.callbackDone}</p>
                      ) : callback === 'open' ? (
                        <form
                          className="space-y-2"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            try {
                              await requestCallback({
                                name: String(f.get('name')),
                                phone: String(f.get('phone')),
                                moment: f.get('moment') as 'MORNING',
                                token: readToken(),
                              });
                              setCallback('sent');
                              if (convId.current) sendEvent(convId.current, 'callback_requested');
                            } catch {
                              setNotice(s.errServer);
                            }
                          }}
                        >
                          <label className="block text-xs font-semibold text-content-muted">
                            {s.name}
                            <input name="name" required minLength={2} maxLength={120} autoComplete="name" className="input mt-1" />
                          </label>
                          <label className="block text-xs font-semibold text-content-muted">
                            {s.phone}
                            <input name="phone" required minLength={6} maxLength={30} type="tel" autoComplete="tel" className="input mt-1" />
                          </label>
                          <label className="block text-xs font-semibold text-content-muted">
                            {s.moment}
                            <select name="moment" className="input mt-1" defaultValue="MORNING">
                              <option value="MORNING">{s.morning}</option>
                              <option value="AFTERNOON">{s.afternoon}</option>
                              <option value="EVENING">{s.evening}</option>
                            </select>
                          </label>
                          <button type="submit" className="btn-outline w-full">{s.callbackSend}</button>
                        </form>
                      ) : (
                        <button type="button" onClick={() => setCallback('open')} className="flex items-center gap-2 text-sm font-semibold text-primary">
                          <PhoneCall className="h-4 w-4" /> {s.callbackTitle}
                        </button>
                      )}
                    </div>
                  )}

                  {phase === 'ended' && (
                    <div className="space-y-2 text-center">
                      <button type="button" onClick={() => { setDemo(null); setNotice(''); setCallback('closed'); setPhase('consent'); }} className="btn-outline w-full">
                        <RotateCcw className="h-4 w-4" /> {s.restart}
                      </button>
                      {convId.current && (
                        <button type="button" onClick={() => void wipe()} className="inline-flex items-center gap-2 text-xs font-semibold text-content-muted hover:text-danger">
                          <Trash2 className="h-4 w-4" /> {s.deleteData}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Bouton d'inscription : toujours le visiteur qui clique */}
                <div className="space-y-3 border-t border-line px-5 py-4">
                  {signup ? (
                    <button type="button" onClick={() => goSignup(signup.data.url)} className="btn-primary w-full rounded-full py-3.5">
                      {s.signupFor(signup.data.planName)} <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button type="button" onClick={() => goSignup('/activation')} className="btn-outline w-full rounded-full py-3">
                      {s.signup} <ArrowRight className="h-4 w-4" />
                    </button>
                  )}

                  {phase !== 'ended' && hasConv && (
                    <>
                      <form onSubmit={submit} className="flex items-center gap-2">
                        <input
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          placeholder={s.placeholder}
                          aria-label={s.placeholder}
                          maxLength={1000}
                          className="input flex-1 rounded-full"
                        />
                        <button type="submit" aria-label={s.send} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-white disabled:opacity-40" disabled={!input.trim()}>
                          <Send className="h-4 w-4" />
                        </button>
                      </form>
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={toggleMic}
                          aria-pressed={micOn}
                          aria-label={micOn ? s.micOn : s.micOff}
                          className={clsx('grid h-14 w-14 place-items-center rounded-full text-white shadow-card transition', micOn ? 'bg-success' : 'bg-content-muted')}
                        >
                          {micOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
                        </button>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={repeat} className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-content-muted hover:bg-surface-2">
                            <RotateCcw className="h-4 w-4" /> {s.repeat}
                          </button>
                          <button type="button" onClick={toggleTts} aria-pressed={tts} aria-label={s.readAloud} title={s.readAloud} className="grid h-11 w-11 place-items-center rounded-full text-content-muted hover:bg-surface-2">
                            {tts ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                          </button>
                          {mode === 'VOICE' && (
                            <button type="button" onClick={() => setShowTranscript((v) => !v)} aria-pressed={showTranscript} className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-content-muted hover:bg-surface-2">
                              <ScrollText className="h-4 w-4" /> {showTranscript ? s.hideTranscript : s.transcript}
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
