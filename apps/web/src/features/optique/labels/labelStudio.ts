import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

/**
 * Studio d'étiquettes : formats prêts à l'emploi, contenu au choix, rendu en
 * HTML millimétré. Le MÊME rendu sert à l'aperçu et à l'impression, pour que
 * ce qui est vu soit ce qui sort de l'imprimante.
 */
export type LabelFormatKey = 'temple38' | 'flag100x12' | 'flag100x15' | 'brandqr35' | 'qr15' | 'custom';
export type CodeKind = 'barcode' | 'qr' | 'both' | 'none';
export type PrintMode = 'roll' | 'sheet';

export interface LabelFormat {
  key: LabelFormatKey;
  name: string;
  hint: string;
  w: number;
  h: number;
  /** Étiquette « queue de rat » : zone imprimée (mm) à gauche, le reste s'enroule. */
  flag?: number;
  layout: 'stack' | 'flag' | 'qrside' | 'qronly';
  defaultCode: CodeKind;
}

export const LABEL_FORMATS: LabelFormat[] = [
  { key: 'temple38', name: 'Branche compacte', hint: '38 × 12 mm · se colle sur la branche', w: 38, h: 12, layout: 'stack', defaultCode: 'barcode' },
  { key: 'flag100x12', name: 'Étiquette à enrouler', hint: '100 × 12 mm · la queue s’enroule autour de la branche', w: 100, h: 12, flag: 45, layout: 'flag', defaultCode: 'barcode' },
  { key: 'flag100x15', name: 'Étiquette à enrouler large', hint: '100 × 15 mm · plus de place pour les détails', w: 100, h: 15, flag: 50, layout: 'flag', defaultCode: 'barcode' },
  { key: 'brandqr35', name: 'Marque + QR', hint: '35 × 15 mm · petite, avec QR code', w: 35, h: 15, layout: 'qrside', defaultCode: 'qr' },
  { key: 'qr15', name: 'QR carré', hint: '15 × 15 mm · identification compacte', w: 15, h: 15, layout: 'qronly', defaultCode: 'qr' },
  { key: 'custom', name: 'Sur mesure', hint: 'Largeur et hauteur libres', w: 50, h: 20, layout: 'stack', defaultCode: 'barcode' },
];

export interface LabelFields {
  brand: boolean;
  model: boolean;
  color: boolean;
  size: boolean;
  price: boolean;
  sku: boolean;
}

export interface LabelSettings {
  format: LabelFormatKey;
  customW: number;
  customH: number;
  fields: LabelFields;
  code: CodeKind;
  /** Valeur encodée : référence interne ou EAN fabricant. */
  codeValue: 'sku' | 'ean';
  mode: PrintMode;
  /** Planche A4 : marge de page et espacement entre étiquettes (mm). */
  sheetMargin: number;
  gap: number;
  /** Décalage d'alignement imprimante (mm). */
  offsetX: number;
  offsetY: number;
}

export const DEFAULT_SETTINGS: LabelSettings = {
  format: 'temple38',
  customW: 50,
  customH: 20,
  fields: { brand: true, model: true, color: false, size: false, price: true, sku: true },
  code: 'barcode',
  codeValue: 'sku',
  mode: 'roll',
  sheetMargin: 8,
  gap: 2,
  offsetX: 0,
  offsetY: 0,
};

export interface LabelItem {
  brand: string;
  model: string;
  color: string;
  size: string;
  price: string;
  sku: string;
  ean: string;
}

export function formatOf(s: LabelSettings): LabelFormat {
  const f = LABEL_FORMATS.find((x) => x.key === s.format) ?? LABEL_FORMATS[0]!;
  if (f.key !== 'custom') return f;
  const w = Math.min(150, Math.max(10, s.customW));
  const h = Math.min(100, Math.max(8, s.customH));
  // Format libre : mise en page déduite des proportions.
  const layout = w / h >= 3 ? 'flag' : w / h <= 1.25 ? 'qronly' : 'stack';
  return { ...f, w, h, layout, flag: layout === 'flag' ? w : undefined };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function barcodeSvg(value: string): string {
  if (!value) return '';
  try {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(el, value, { format: 'CODE128', width: 1, height: 30, displayValue: false, margin: 0, background: '#ffffff', lineColor: '#000000' });
    el.setAttribute('preserveAspectRatio', 'none');
    el.removeAttribute('width');
    el.removeAttribute('height');
    el.setAttribute('style', 'width:100%;height:100%;display:block');
    return el.outerHTML;
  } catch {
    return '';
  }
}

async function qrSvg(value: string): Promise<string> {
  if (!value) return '';
  try {
    const svg = await QRCode.toString(value, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
    return svg.replace('<svg ', '<svg style="width:100%;height:100%;display:block" ');
  } catch {
    return '';
  }
}

/** HTML d'une étiquette, dimensionné en millimètres. */
export async function labelHtml(item: LabelItem, s: LabelSettings, opts: { outline?: boolean } = {}): Promise<string> {
  const f = formatOf(s);
  const value = (s.codeValue === 'ean' && item.ean) || item.sku;
  const wantBar = s.code === 'barcode' || s.code === 'both';
  const wantQr = s.code === 'qr' || s.code === 'both';
  const bar = wantBar ? barcodeSvg(value) : '';
  const qr = wantQr ? await qrSvg(value) : '';
  const F = s.fields;

  const title = F.brand && item.brand ? item.brand : F.model ? item.model : '';
  const sub = [F.brand && item.brand && F.model ? item.model : '', F.color ? item.color : '', F.size ? item.size : ''].filter(Boolean).join(' · ');
  const price = F.price ? item.price : '';
  const ref = F.sku ? value : '';

  // Taille de police en mm, proportionnelle à la hauteur utile.
  const H = f.h;
  const big = Math.min(3.2, H * 0.24);
  const small = Math.min(2.4, H * 0.17);
  const pad = Math.max(0.6, Math.min(1.2, H * 0.07));
  const T = (txt: string, size: number, bold = false, mono = false) =>
    txt ? `<div style="font-size:${size}mm;line-height:1.1;${bold ? 'font-weight:800;' : ''}${mono ? 'font-family:ui-monospace,monospace;' : ''}white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(txt)}</div>` : '';

  let inner = '';
  const area = f.flag ?? f.w;
  if (f.layout === 'stack') {
    inner = `<div style="display:flex;flex-direction:column;justify-content:space-between;height:100%;gap:0.3mm">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:1mm">${T(title, big, true)}${price ? `<div style="font-size:${big}mm;font-weight:900;white-space:nowrap">${esc(price)}</div>` : ''}</div>
      ${sub ? T(sub, small) : ''}
      <div style="display:flex;gap:1mm;flex:1;min-height:0;align-items:stretch">${bar ? `<div style="flex:1;min-width:0">${bar}</div>` : ''}${qr ? `<div style="height:100%;aspect-ratio:1">${qr}</div>` : ''}</div>
      ${ref ? `<div style="text-align:center">${T(ref, small * 0.85, false, true)}</div>` : ''}
    </div>`;
  } else if (f.layout === 'flag') {
    const codeW = qr && !bar ? `${H - 2 * pad}mm` : `${area * 0.38}mm`;
    inner = `<div style="display:flex;height:100%;width:${area - 2 * pad}mm;gap:1.2mm;align-items:center">
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:0.3mm">${T(title, big, true)}${sub ? T(sub, small * 0.85) : ''}${price ? T(price, big, true) : ''}${ref && !bar ? T(ref, small * 0.85, false, true) : ''}</div>
      ${bar || qr ? `<div style="width:${codeW};height:100%;display:flex;flex-direction:column;gap:0.3mm">${bar ? `<div style="flex:1;min-height:0">${bar}</div>` : ''}${qr && !bar ? qr : ''}${ref && bar ? `<div style="text-align:center">${T(ref, small * 0.75, false, true)}</div>` : ''}</div>` : ''}
    </div>`;
  } else if (f.layout === 'qrside') {
    inner = `<div style="display:flex;height:100%;gap:1mm;align-items:center">
      ${qr || bar ? `<div style="height:100%;${qr ? 'aspect-ratio:1' : 'width:45%'}">${qr || bar}</div>` : ''}
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:0.3mm">${T(title, big * 0.8, true)}${sub ? T(sub, small * 0.9) : ''}${price ? T(price, small * 1.1, true) : ''}${ref ? T(ref, small * 0.8, false, true) : ''}</div>
    </div>`;
  } else {
    inner = `<div style="display:flex;flex-direction:column;height:100%;align-items:center;gap:0.3mm">
      <div style="flex:1;min-height:0;aspect-ratio:1">${qr || bar}</div>${ref ? T(ref, Math.min(1.8, small), false, true) : ''}
    </div>`;
  }

  const tail =
    f.flag && f.flag < f.w
      ? `<div style="position:absolute;left:${f.flag}mm;top:${H * 0.35}mm;width:${f.w - f.flag}mm;height:${H * 0.3}mm;${opts.outline ? 'border:0.2mm dashed #9ca3af;border-left:0;' : ''}"></div>`
      : '';
  return `<div class="lbl" style="position:relative;width:${f.w}mm;height:${H}mm;overflow:hidden;background:#fff;color:#000;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;${opts.outline ? 'outline:0.2mm dashed #9ca3af;' : ''}">
    <div style="position:absolute;left:${pad + s.offsetX}mm;top:${pad + s.offsetY}mm;width:${(f.flag ?? f.w) - 2 * pad}mm;height:${H - 2 * pad}mm">${inner}</div>${tail}
  </div>`;
}

/** Document complet à imprimer (rouleau : une étiquette par page ; planche : grille A4). */
export async function printDocument(items: LabelItem[], s: LabelSettings, test = false): Promise<string> {
  const f = formatOf(s);
  const labels = await Promise.all(items.map((it) => labelHtml(it, s, { outline: test })));
  const page =
    s.mode === 'roll'
      ? `@page{size:${f.w}mm ${f.h}mm;margin:0}.lbl{page-break-after:always;break-after:page}`
      : `@page{size:A4;margin:${s.sheetMargin}mm}.sheet{display:flex;flex-wrap:wrap;gap:${s.gap}mm;align-content:flex-start}.lbl{break-inside:avoid}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Étiquettes</title><style>
    *{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}${page}
    ${test ? '.lbl{outline:0.3mm solid #000 !important}' : ''}
  </style></head><body>${s.mode === 'roll' ? labels.join('') : `<div class="sheet">${labels.join('')}</div>`}</body></html>`;
}

/** Imprime via un cadre caché : seule la planche d'étiquettes part à l'imprimante. */
export function printHtml(html: string): void {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  const go = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60_000);
  };
  if (doc.readyState === 'complete') setTimeout(go, 150);
  else frame.onload = () => setTimeout(go, 150);
}

const KEY = 'oculo_label_studio';
export function loadSettings(): LabelSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const v = JSON.parse(raw) as Partial<LabelSettings>;
    return { ...DEFAULT_SETTINGS, ...v, fields: { ...DEFAULT_SETTINGS.fields, ...(v.fields ?? {}) } };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
export function saveSettings(s: LabelSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* stockage indisponible */
  }
}
