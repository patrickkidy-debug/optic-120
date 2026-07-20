import {
  DEFAULT_WA_TEMPLATES,
  fillWaTemplate,
  type SaleWaStage,
  type WhatsappTemplates,
} from '@oculo/shared-types';
import { useAuthStore } from '../store/auth';

/** Lien wa.me à partir d'un numéro (chiffres uniquement). */
export function waLink(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, '');
  return digits ? `https://wa.me/${digits}` : null;
}

/**
 * Ouvre WhatsApp avec un message pré-rempli pour une étape de vente.
 *
 * L'envoi reste manuel : le lien wa.me ouvre WhatsApp (appli ou web) avec le
 * texte déjà rédigé et le numéro du client ; l'utilisateur appuie sur Envoyer.
 * Aucune API, aucun quota. Renvoie false si le client n'a pas de numéro.
 */
export function sendWhatsappForStage(
  stage: SaleWaStage,
  phone: string | null | undefined,
  vars: Record<string, string | number>,
): boolean {
  const link = waLink(phone);
  if (!link) {
    alert("Ce client n'a pas de numéro WhatsApp enregistré.");
    return false;
  }
  const templates: WhatsappTemplates =
    useAuthStore.getState().user?.tenantWhatsappTemplates ?? {};
  const tpl = templates[stage] ?? DEFAULT_WA_TEMPLATES[stage];
  const text = fillWaTemplate(tpl, vars);
  window.open(`${link}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  return true;
}
