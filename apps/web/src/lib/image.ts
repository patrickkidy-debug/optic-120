/** Formats matriciels acceptés (le SVG est refusé : risque de script embarqué). */
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
/** Taille max du fichier source AVANT redimensionnement. */
const MAX_INPUT_BYTES = 10 * 1024 * 1024; // 10 Mo

/**
 * Lit un fichier image, le redimensionne (max `maxSize` px sur le plus grand
 * côté) et renvoie une data URL compacte. PNG conservé (transparence des logos),
 * sinon JPEG. Valide le type et la taille en amont pour un upload robuste.
 */
export async function fileToResizedDataUrl(file: File, maxSize = 256): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Format non supporté. Utilisez une image PNG, JPEG, WebP ou GIF.');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('Fichier trop volumineux (10 Mo maximum).');
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
    i.onerror = () => reject(new Error('Image invalide'));
    i.src = source;
  });

  let { width, height } = img;
  if (width >= height && width > maxSize) {
    height = Math.round((height * maxSize) / width);
    width = maxSize;
  } else if (height > maxSize) {
    width = Math.round((width * maxSize) / height);
    height = maxSize;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return source;
  ctx.drawImage(img, 0, 0, width, height);
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return canvas.toDataURL(type, 0.85);
}
