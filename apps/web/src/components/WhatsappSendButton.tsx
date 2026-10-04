import type { ReactNode } from 'react';
import { MessageCircle } from 'lucide-react';
import type { WaMessageLang } from '@oculo/shared-types';
import { useAuthStore } from '../store/auth';
import { waMessageLangs } from '../lib/whatsapp';

/**
 * Bouton d'envoi d'un message WhatsApp pré-rempli. Pour un établissement
 * bilingue (Rwanda), il se dédouble en « FR » / « EN » : l'utilisateur choisit
 * la langue du message à chaque envoi. Ailleurs, un seul bouton, comme avant.
 */
export function WhatsappSendButton({
  onSend,
  className,
  title,
  children,
}: {
  onSend: (lang?: WaMessageLang) => void;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  const country = useAuthStore((s) => s.user?.tenantCountryCode);
  const langs = waMessageLangs(country);
  if (langs.length < 2) {
    return (
      <button type="button" onClick={() => onSend()} className={className} title={title}>
        {children}
      </button>
    );
  }
  return (
    <span className="inline-flex items-stretch" title={title}>
      {langs.map((l, i) => (
        <button
          key={l}
          type="button"
          onClick={() => onSend(l)}
          className={`${className ?? ''} ${i === 0 ? 'rounded-r-none' : '-ml-px rounded-l-none'}`}
        >
          {i === 0 && <MessageCircle className="h-3.5 w-3.5" />} {l.toUpperCase()}
        </button>
      ))}
    </span>
  );
}
