import {
  DEFAULT_WA_TEMPLATES,
  DEFAULT_WA_TEMPLATES_EN,
  DEFAULT_WA_TEMPLATES_FR,
  WA_MESSAGE_LANGS_BY_COUNTRY,
  fillWaTemplate,
  type SaleWaStage,
  type WaMessageLang,
  type WhatsappTemplates,
} from '@oculo/shared-types';
import { useAuthStore } from '../store/auth';
import { tr } from './tr';

/** Lien wa.me à partir d'un numéro (chiffres uniquement). */
export function waLink(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, '');
  return digits ? `https://wa.me/${digits}` : null;
}

/** Numéro WhatsApp de l'équipe pour les demandes de démonstration gratuite (landing + dashboard). */
export const DEMO_WHATSAPP_NUMBER = '2385936598';

/** Numéro de l'équipe au format lisible : « +238 593 65 98 ». */
export const TEAM_WHATSAPP_DISPLAY = '+238 593 65 98';

/**
 * Lien WhatsApp pour envoyer le reçu d'un virement à l'équipe, message
 * pré-rempli avec la facture : l'équipe retrouve le paiement sans échange.
 */
export function transferReceiptLink(info: { invoiceNumber?: string; establishment?: string | null; amount?: string }): string {
  const lines = [
    tr('ui.whatsapp.bonjourVoiciLaCaptureLe'),
    info.invoiceNumber ? tr('ui.whatsapp.factureInvoicenumber', { invoiceNumber: info.invoiceNumber }) : '',
    info.establishment ? tr('ui.whatsapp.etablissementEstablishment', { establishment: info.establishment }) : '',
    info.amount ? tr('ui.whatsapp.montantAmount', { amount: info.amount }) : '',
  ].filter(Boolean);
  return `https://wa.me/${DEMO_WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`;
}

/** Lien wa.me pré-rempli vers l'équipe, pour une demande de démonstration. */
export function demoWhatsappLink(message: string): string {
  return `https://wa.me/${DEMO_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
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
  lang?: WaMessageLang,
): boolean {
  const link = waLink(phone);
  if (!link) {
    alert(tr('ui.whatsapp.ceClientNAPas'));
    return false;
  }
  const templates: WhatsappTemplates =
    useAuthStore.getState().user?.tenantWhatsappTemplates ?? {};
  // Établissement bilingue (Rwanda) : la langue choisie au clic décide du modèle,
  // indépendamment de la langue de l'interface.
  const tpl =
    lang === 'en'
      ? templates.en?.[stage] ?? DEFAULT_WA_TEMPLATES_EN[stage]
      : lang === 'fr'
        ? templates[stage] ?? DEFAULT_WA_TEMPLATES_FR[stage]
        : templates[stage] ?? DEFAULT_WA_TEMPLATES[stage];
  const text = fillWaTemplate(tpl, vars);
  window.open(`${link}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  return true;
}

/**
 * Langues proposées pour les messages clients de l'établissement connecté :
 * deux au Rwanda (anglais, français), sinon une seule (comportement habituel).
 */
export function waMessageLangs(countryCode?: string | null): readonly WaMessageLang[] {
  return (countryCode && WA_MESSAGE_LANGS_BY_COUNTRY[countryCode]) || [];
}
