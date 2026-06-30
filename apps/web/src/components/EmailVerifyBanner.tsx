import { useState } from 'react';
import { MailWarning } from 'lucide-react';
import { resendVerification } from '../features/auth/api';
import { useAuthStore } from '../store/auth';

/**
 * Bandeau affiché tant que l'utilisateur n'a pas confirmé son adresse email.
 * Propose de renvoyer l'email de confirmation.
 */
export function EmailVerifyBanner() {
  const user = useAuthStore((s) => s.user);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');

  if (!user || user.emailVerified || user.isPlatformOperator) return null;

  async function resend() {
    setState('sending');
    try {
      await resendVerification();
      setState('sent');
    } catch {
      setState('idle');
    }
  }

  return (
    <div className="border-b border-[color:var(--warning)]/30 bg-[color:var(--warning)]/12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-2.5 sm:flex-row sm:px-6">
        <p className="flex items-center gap-2 text-sm font-medium text-content">
          <MailWarning className="h-4 w-4 text-warning" />
          Confirmez votre adresse <b>{user.email}</b> — vérifiez votre boîte de réception.
        </p>
        {state === 'sent' ? (
          <span className="text-xs font-medium text-success">Email renvoyé ✅</span>
        ) : (
          <button
            onClick={resend}
            disabled={state === 'sending'}
            className="h-8 shrink-0 rounded-lg border border-[color:var(--warning)]/40 px-3 text-xs font-semibold text-content transition hover:bg-[color:var(--warning)]/10 disabled:opacity-60"
          >
            {state === 'sending' ? 'Envoi…' : "Renvoyer l'email"}
          </button>
        )}
      </div>
    </div>
  );
}
