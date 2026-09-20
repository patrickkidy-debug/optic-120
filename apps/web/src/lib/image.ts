/** Formats matriciels acceptés (le SVG est refusé : risque de script embarqué). */
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
/** Taille max du fichier source AVANT redimensionnement. */
const MAX_INPUT_BYTES = 10 * 1024 * 1024; // 10 Mo

/**
 * Poids maximal de la data URL produite. Les images voyagent en base64 dans le
 * corps JSON : au-delà, la requête est refusée par le serveur (limite 6 Mo) et
 * l'enregistrement échouait sans explication. On compresse jusqu'à tenir dans
 * ce budget, et on le dit clairement si c'est impossible.
 */
const DEFAULT_MAX_OUTPUT_BYTES = 600 * 1024;

/** Poids approximatif d'une data URL base64, en octets. */
function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}

/** Formate un poids en Ko/Mo pour un message lisible. */
export function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
    : `${Math.round(bytes / 1024)} Ko`;
}

/**
 * Lit un fichier image, le redimensionne (max `maxSize` px sur le plus grand
 * côté) et renvoie une data URL compacte.
 *
 * Le PNG est conservé UNIQUEMENT s'il reste léger (transparence des logos) :
 * une photo enregistrée en PNG produit sinon une base64 énorme. Au-delà du
 * budget, on repasse en JPEG et on baisse la qualité par paliers ; si l'image
 * ne tient toujours pas, une erreur explicite est levée.
 */
export async function fileToResizedDataUrl(
  file: File,
  maxSize = 256,
  maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Format non supporté. Utilisez une image PNG, JPEG ou WebP.');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error(
      `Image trop lourde : ${formatBytes(file.size)} (maximum ${formatBytes(MAX_INPUT_BYTES)}). Réduisez-la avant de l'importer.`,
    );
  }

  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Image invalide ou illisible'));
    i.src = source;
  });

  /** Rend l'image à une largeur donnée, dans le format demandé. */
  function render(targetSize: number, type: string, quality: number): string | null {
    let { width, height } = img;
    if (width >= height && width > targetSize) {
      height = Math.round((height * targetSize) / width);
      width = targetSize;
    } else if (height > targetSize) {
      width = Math.round((width * targetSize) / height);
      height = targetSize;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // Fond blanc pour le JPEG : sans cela, la transparence devient noire.
    if (type === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(type, quality);
  }

  // 1er essai : on respecte le PNG (utile pour les logos transparents).
  const preferPng = file.type === 'image/png';
  let out = render(maxSize, preferPng ? 'image/png' : 'image/jpeg', 0.85);
  if (!out) return source;
  if (dataUrlBytes(out) <= maxOutputBytes) return out;

  // Trop lourd : on compresse par paliers (JPEG, qualité puis dimensions).
  for (const [size, quality] of [
    [maxSize, 0.75],
    [maxSize, 0.6],
    [Math.round(maxSize * 0.75), 0.6],
    [Math.round(maxSize * 0.6), 0.55],
  ] as [number, number][]) {
    const candidate = render(size, 'image/jpeg', quality);
    if (candidate && dataUrlBytes(candidate) <= maxOutputBytes) return candidate;
    if (candidate) out = candidate;
  }

  throw new Error(
    `Image trop lourde après compression (${formatBytes(dataUrlBytes(out))}, maximum ${formatBytes(maxOutputBytes)}). Utilisez une photo moins détaillée.`,
  );
}

/** Convertit une Data URL en objet Blob pour le transfert HTTP/Storage. */
function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Raison pour laquelle l'hébergement a été contourné. L'image reste utilisable
 * (repli sur une data URL encodée dans la donnée), mais elle n'a alors aucune
 * adresse publique : impossible de la partager en lien, et son poids part en
 * base de données. Exposer la cause évite d'avoir à ouvrir la console du
 * navigateur pour diagnostiquer.
 */
export type UploadFallbackReason =
  | { kind: 'not-configured' }
  | { kind: 'upload-refused'; message: string }
  | { kind: 'no-public-url' }
  | { kind: 'unexpected'; message: string };

/** Phrase prête à afficher, avec le geste correctif. */
export function describeUploadFallback(r: UploadFallbackReason): string {
  switch (r.kind) {
    case 'not-configured':
      return "L'hébergement d'images n'est pas configuré sur ce site : les variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY manquent. Elles sont figées à la construction du site — après les avoir ajoutées, il faut relancer un déploiement.";
    case 'upload-refused':
      return `L'hébergement d'images a refusé l'envoi : ${r.message}. Vérifiez que le bucket existe, qu'il est public, et qu'il autorise l'envoi.`;
    case 'no-public-url':
      return "L'image a été envoyée mais aucune adresse publique n'a été renvoyée : le bucket n'est probablement pas public.";
    default:
      return `L'hébergement d'images est injoignable : ${r.message}.`;
  }
}

/**
 * Envoie une image sur Supabase Storage et renvoie son URL publique.
 *
 * En cas d'échec, renvoie la data URL locale pour ne jamais bloquer la saisie,
 * et signale la cause via `onFallback` — sans quoi l'échec est invisible et
 * l'image finit stockée dans la donnée sans que personne ne le sache.
 */
export async function uploadImageToSupabase(
  file: File,
  folder = 'uploads',
  maxSize = 800,
  maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
  onFallback?: (reason: UploadFallbackReason) => void,
): Promise<string> {
  const localDataUrl = await fileToResizedDataUrl(file, maxSize, maxOutputBytes);

  try {
    const { supabase, SUPABASE_STORAGE_BUCKET, isSupabaseConfigured } = await import('./supabase');

    if (!isSupabaseConfigured()) {
      onFallback?.({ kind: 'not-configured' });
      return localDataUrl;
    }

    const blob = dataUrlToBlob(localDataUrl);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;

    const { data, error } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(filename, blob, {
        contentType: blob.type || 'image/jpeg',
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.warn(`Supabase Storage upload error (${error.message}), fallback data URL`, error);
      onFallback?.({ kind: 'upload-refused', message: error.message });
      return localDataUrl;
    }

    const { data: publicUrlData } = supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .getPublicUrl(data.path);

    if (!publicUrlData.publicUrl) {
      onFallback?.({ kind: 'no-public-url' });
      return localDataUrl;
    }
    return publicUrlData.publicUrl;
  } catch (err) {
    console.warn("Erreur lors de l'envoi vers Supabase Storage, fallback Data URL", err);
    onFallback?.({
      kind: 'unexpected',
      message: err instanceof Error ? err.message : String(err),
    });
    return localDataUrl;
  }
}

