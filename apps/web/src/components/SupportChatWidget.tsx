import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, X, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { createSupportTicket } from '../features/support/api';
import { apiErrorMessage } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { useUIStore } from '../store/ui';

/**
 * Bulle de discussion flottante (assistance intégrée). L'utilisateur écrit un
 * message → un ticket de support est créé et arrive dans la console fondateur.
 * Aucune dépendance externe : réponse par email / console.
 */
export function SupportChatWidget() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const firstName = useAuthStore((s) => s.user?.firstName);
  const hidden = useUIStore((s) => s.supportWidgetHidden);
  const setHidden = useUIStore((s) => s.setSupportWidgetHidden);

  // L'utilisateur a choisi de retirer le bouton d'aide (réactivable dans Réglages).
  if (hidden) return null;

  async function send() {
    const text = message.trim();
    if (text.length < 5) {
      setError('Écrivez au moins quelques mots.');
      return;
    }
    setSending(true);
    setError('');
    try {
      await createSupportTicket({ subject: text.slice(0, 80), message: text });
      setSent(true);
      setMessage('');
    } catch (e) {
      setError(apiErrorMessage(e, "Envoi impossible. Réessayez."));
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed z-50 print:hidden"
      style={{
        bottom: 'max(1.25rem, env(safe-area-inset-bottom))',
        right: 'max(1.25rem, env(safe-area-inset-right))',
      }}
    >
      {open ? (
        <div className="flex w-[min(92vw,360px)] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card-lg">
          {/* En-tête */}
          <div className="flex items-center justify-between bg-brand px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15">
                <MessageCircle className="h-5 w-5" />
              </span>
              <div>
                <div className="font-display text-sm font-bold leading-tight">Assistance OculoSaaS</div>
                <div className="text-[11px] text-white/80">On vous répond rapidement 👋</div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="grid h-8 w-8 place-items-center rounded-lg text-white/90 transition hover:bg-white/15"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Corps */}
          <div className="flex max-h-[320px] flex-col gap-3 overflow-y-auto bg-bg-subtle px-4 py-4">
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-surface-2 px-3.5 py-2.5 text-sm text-content shadow-card">
              Bonjour {firstName || ''} 👋 Une question ou un souci ? Écrivez-nous ici, notre
              équipe vous répond par email au plus vite.
            </div>
            {sent && (
              <div className="flex items-start gap-2 self-end rounded-2xl rounded-tr-sm bg-success/15 px-3.5 py-2.5 text-sm text-success">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                Message envoyé ! Nous revenons vers vous très vite.
              </div>
            )}
          </div>

          {/* Saisie */}
          <div className="border-t border-line bg-surface p-3">
            {error && <p className="mb-2 text-xs text-danger">{error}</p>}
            <div className="flex items-end gap-2">
              <textarea
                className="input max-h-32 min-h-[44px] flex-1 resize-none py-2.5"
                placeholder="Votre message…"
                rows={1}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  if (sent) setSent(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <button
                onClick={() => void send()}
                disabled={sending || message.trim().length < 5}
                aria-label="Envoyer"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative">
          <button
            onClick={() => setOpen(true)}
            aria-label="Ouvrir l'assistance"
            className="group flex items-center gap-2 rounded-full bg-brand px-4 py-3.5 text-white shadow-card-lg transition hover:-translate-y-0.5 hover:shadow-glow"
          >
            <MessageCircle className="h-6 w-6" />
            <span className="hidden text-sm font-semibold sm:inline">{t('common.needHelp')}</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setHidden(true);
            }}
            aria-label="Masquer le bouton d'aide"
            title="Masquer (réactivable dans Réglages → Apparence)"
            className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border border-line bg-surface text-content-muted shadow-card transition hover:text-danger"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
