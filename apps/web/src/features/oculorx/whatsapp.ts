import { RX_FRAME_LABELS, RX_GEOMETRY_LABELS, RX_STATUS_LABELS, rxDiopter, type RxFrameType, type RxGeometry } from '@oculo/shared-types';
import type { RxOrder } from './api';

/** Numéro joignable sur WhatsApp (chiffres seuls), ou null. */
export function waNumber(supplier: { whatsapp?: string | null; phone?: string | null }): string | null {
  const digits = (supplier.whatsapp || supplier.phone || '').replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

/**
 * Message WhatsApp au fournisseur : la commande complète (verre, OD/OG,
 * options), son statut et le lien du portail fournisseur pour la suivre.
 * Jamais de prix de vente patient.
 */
export function orderWhatsappText(o: RxOrder, storeName: string): string {
  const eye = (e: RxOrder['od']) => `${rxDiopter(e.sph)}${e.cyl ? ` (${rxDiopter(e.cyl)}) ${e.axis ?? 0}°` : ''}`;
  const options = [o.mounted && 'Taillé-monté', o.urgent && 'URGENT'].filter(Boolean).join(' · ');
  const lines = [
    `Bonjour, commande de verres *${o.number}* — ${storeName}`,
    '',
    `Verre : ${o.lens.reference} — ${o.lens.designation} (${RX_GEOMETRY_LABELS[o.lens.geometry as RxGeometry] ?? o.lens.geometry})`,
    `Patient : ${o.patientName}${o.fileNumber ? ` · dossier ${o.fileNumber}` : ''}`,
    `OD : ${eye(o.od)}`,
    `OG : ${eye(o.og)}`,
    ...(o.addition != null ? [`Addition : ${rxDiopter(o.addition)}`] : []),
    `EP : ${o.pd ?? '—'} mm · Hauteur : ${o.height ?? '—'} mm${o.frameType ? ` · Monture ${RX_FRAME_LABELS[o.frameType as RxFrameType]}` : ''}`,
    ...(options ? [`Options : ${options}`] : []),
    ...(o.comment ? [`Commentaire : ${o.comment}`] : []),
    '',
    `Statut : ${RX_STATUS_LABELS[o.status]}${o.lensOrder?.trackCode ? ` · suivi ${o.lensOrder.trackCode}` : ''}`,
    `Suivez et mettez à jour nos commandes sur votre portail : ${window.location.origin}/portail`,
  ];
  return lines.join('\n');
}

/** Un seul message pour plusieurs commandes du même fournisseur (envoi groupé). */
export function ordersWhatsappText(orders: RxOrder[], storeName: string): string {
  const eye = (e: RxOrder['od']) => `${rxDiopter(e.sph)}${e.cyl ? ` (${rxDiopter(e.cyl)}) ${e.axis ?? 0}°` : ''}`;
  const blocks = orders.map((o, i) => [
    `*${i + 1}. ${o.number}* — ${o.lens.reference} · ${o.lens.designation}`,
    `   Patient : ${o.patientName}${o.fileNumber ? ` (${o.fileNumber})` : ''}`,
    `   OD ${eye(o.od)} · OG ${eye(o.og)}${o.addition != null ? ` · Add ${rxDiopter(o.addition)}` : ''}`,
    `   EP ${o.pd ?? '—'} · H ${o.height ?? '—'}${o.frameType ? ` · ${RX_FRAME_LABELS[o.frameType as RxFrameType]}` : ''}${o.mounted ? ' · Taillé-monté' : ''}${o.urgent ? ' · URGENT' : ''}`,
    ...(o.comment ? [`   ${o.comment}`] : []),
  ].join('\n'));
  return [
    `Bonjour, voici nos ${orders.length} commande(s) de verres du jour — ${storeName}`,
    '',
    ...blocks,
    '',
    `Suivi et mise à jour sur votre portail : ${window.location.origin}/portail`,
  ].join('\n');
}

export function openWhatsapp(number: string, text: string) {
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}
