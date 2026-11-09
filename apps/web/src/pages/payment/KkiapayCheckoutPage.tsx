import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, BadgeCheck, Loader2, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui';

/** Widget officiel KkiaPay (Mobile Money et cartes). */
const KKIAPAY_SCRIPT = 'https://cdn.kkiapay.me/k.js';
/** Relectures de la transaction le temps que KkiaPay la finalise. */
const CONFIRM_TRIES = 10;
const CONFIRM_DELAY_MS = 3000;

interface KkiapayWindow extends Window {
  openKkiapayWidget?: (options: Record<string, unknown>) => void;
  addSuccessListener?: (cb: (response: Record<string, unknown>) => void) => void;
  addFailedListener?: (cb: (error: unknown) => void) => void;
}

let scriptPromise: Promise<void> | null = null;
function loadKkiapay(): Promise<void> {
  const w = window as KkiapayWindow;
  if (w.openKkiapayWidget) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = KKIAPAY_SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('Widget KkiaPay injoignable'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/** Retour uniquement vers l'application elle-même (jamais de redirection ouverte). */
function safeReturn(raw: string | null): string {
  const fallback = '/parametres/abonnement';
  if (!raw) return fallback;
  try {
    const u = new URL(raw, window.location.origin);
    return u.origin === window.location.origin ? u.pathname + u.search + u.hash : fallback;
  } catch {
    return fallback;
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Paiement d'abonnement par KkiaPay.
 *
 * KkiaPay ne fournit pas de page de paiement hébergée : le serveur renvoie ici,
 * cette page ouvre le widget avec notre identifiant de paiement (partnerId),
 * puis transmet l'identifiant de transaction au serveur. C'est le SERVEUR qui
 * relit la transaction chez KkiaPay (statut, montant, rattachement) avant
 * d'activer quoi que ce soit : rien de ce que dit le navigateur n'est cru.
 */
export function KkiapayCheckoutPage() {
  const [params] = useSearchParams();
  const paymentId = params.get('p') ?? '';
  const amount = Number(params.get('a') ?? NaN);
  const key = params.get('k') ?? '';
  const sandbox = params.get('sb') === '1';
  const back = safeReturn(params.get('r'));
  const valid = Boolean(paymentId && key && Number.isFinite(amount) && amount > 0);

  const [phase, setPhase] = useState<'loading' | 'open' | 'confirming' | 'done' | 'failed' | 'error'>(
    valid ? 'loading' : 'error',
  );
  const [message, setMessage] = useState(valid ? '' : 'Lien de paiement incomplet.');
  const listening = useRef(false);
  const confirming = useRef(false);

  const confirm = useCallback(
    async (transactionId: string) => {
      if (confirming.current) return;
      confirming.current = true;
      setPhase('confirming');
      try {
        sessionStorage.setItem(`kkiapay:${paymentId}`, transactionId);
      } catch {
        // Stockage indisponible : la confirmation continue sans reprise possible.
      }
      for (let i = 0; i < CONFIRM_TRIES; i++) {
        try {
          const { data } = await api.post<{ status: string }>('/webhooks/kkiapay-confirm', { paymentId, transactionId });
          if (data.status === 'SUCCESS') {
            setPhase('done');
            await wait(1200);
            window.location.replace(back);
            return;
          }
        } catch {
          // Réseau ou serveur en réveil : on retente.
        }
        await wait(CONFIRM_DELAY_MS);
      }
      // Paiement probablement reçu mais pas encore confirmé : le webhook KkiaPay
      // prendra le relais, l'écran de retour suit l'état réel.
      window.location.replace(back);
    },
    [paymentId, back],
  );

  const open = useCallback(async () => {
    setMessage('');
    try {
      await loadKkiapay();
      const w = window as KkiapayWindow;
      if (!w.openKkiapayWidget) throw new Error('Widget KkiaPay indisponible');
      if (!listening.current) {
        listening.current = true;
        w.addSuccessListener?.((response) => {
          const id = String(response.transactionId ?? response.transaction_id ?? response.id ?? '');
          if (id) void confirm(id);
        });
        w.addFailedListener?.(() => {
          setPhase('failed');
          setMessage('Le paiement n’a pas abouti. Vous pouvez réessayer.');
        });
      }
      w.openKkiapayWidget({
        amount: Math.round(amount),
        key,
        sandbox,
        partnerId: paymentId,
        data: paymentId,
        position: 'center',
        theme: '#0E7C86',
        ...(params.get('n') ? { name: params.get('n') } : {}),
        ...(params.get('e') ? { email: params.get('e') } : {}),
        ...(params.get('ph') ? { phone: params.get('ph') } : {}),
      });
      setPhase('open');
    } catch (e) {
      setPhase('error');
      setMessage(e instanceof Error ? e.message : 'Paiement indisponible');
    }
  }, [amount, key, sandbox, paymentId, params, confirm]);

  useEffect(() => {
    if (!valid) return;
    // Page rechargée après un paiement : on reprend la confirmation.
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem(`kkiapay:${paymentId}`);
    } catch {
      pending = null;
    }
    if (pending) void confirm(pending);
    else void open();
  }, [valid, paymentId, confirm, open]);

  return (
    <div className="grid min-h-screen place-items-center bg-surface-2 px-4 text-center">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-sm">
        {phase === 'done' ? (
          <BadgeCheck className="mx-auto h-12 w-12 text-success" />
        ) : phase === 'failed' || phase === 'error' ? (
          <AlertTriangle className="mx-auto h-12 w-12 text-danger" />
        ) : (
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
        )}
        <h1 className="mt-4 text-lg font-semibold text-content">
          {phase === 'done'
            ? 'Paiement confirmé'
            : phase === 'confirming'
              ? 'Confirmation du paiement…'
              : phase === 'failed'
                ? 'Paiement non abouti'
                : phase === 'error'
                  ? 'Paiement indisponible'
                  : 'Paiement sécurisé'}
        </h1>
        {valid && (
          <p className="mt-1 text-2xl font-bold text-content">
            {Math.round(amount).toLocaleString('fr-FR')} FCFA
          </p>
        )}
        <p className="mt-2 text-sm text-content-muted">
          {message ||
            (phase === 'confirming' || phase === 'done'
              ? 'Ne fermez pas cette page.'
              : 'Mobile Money ou carte bancaire, dans la fenêtre KkiaPay.')}
        </p>
        {sandbox && <p className="mt-2 text-xs font-medium text-warning">Mode test KkiaPay : aucun argent réel.</p>}

        {phase !== 'confirming' && phase !== 'done' && (
          <div className="mt-5 grid gap-2">
            {valid && (
              <Button onClick={() => void open()}>
                {phase === 'failed' ? 'Réessayer' : 'Ouvrir le paiement'}
              </Button>
            )}
            <Button variant="outline" onClick={() => window.location.replace(back)}>
              Retour
            </Button>
          </div>
        )}
        <p className="mt-5 flex items-center justify-center gap-1 text-xs text-content-muted">
          <ShieldCheck className="h-3.5 w-3.5" /> Paiement traité par KkiaPay
        </p>
      </div>
    </div>
  );
}
