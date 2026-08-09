import { useRef, useState } from 'react';
import { ImagePlus, Trash2, Star, ZoomIn, X, Loader2 } from 'lucide-react';
import { MAX_PRODUCT_PHOTOS } from '@oculo/shared-types';
import { fileToResizedDataUrl } from '../../lib/image';
import { Modal } from '../../components/ui';

/**
 * Résolution de stockage des photos produit. Les images vivent en data URL
 * dans la base : on redimensionne fermement pour garder des fiches légères
 * (une photo de catalogue n'a pas besoin de plus).
 */
const MAIN_SIZE = 800;
const EXTRA_SIZE = 640;
/** Budget de poids par image : le corps JSON complet doit rester sous 6 Mo. */
const MAIN_MAX_BYTES = 600 * 1024;
const EXTRA_MAX_BYTES = 400 * 1024;

/**
 * Galerie photo d'un produit : photo principale + photos secondaires.
 * Glisser-déposer, sélection par clic, remplacement, promotion d'une photo
 * secondaire en principale, suppression et zoom plein écran.
 */
export function PhotoUploader({
  photoUrl,
  photos,
  onChange,
}: {
  photoUrl: string;
  photos: string[];
  onChange: (next: { photoUrl: string; photos: string[] }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState<string | null>(null);

  const remaining = MAX_PRODUCT_PHOTOS - photos.length;

  /** Traite les fichiers déposés/choisis : la 1re devient principale si vide. */
  async function ingest(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setBusy(true);
    setError('');
    try {
      let main = photoUrl;
      const extra = [...photos];
      const problems: string[] = [];

      for (const file of list) {
        if (main && extra.length >= MAX_PRODUCT_PHOTOS) {
          problems.push(`« ${file.name} » ignorée : maximum ${MAX_PRODUCT_PHOTOS} photos secondaires.`);
          continue;
        }
        // Une image en échec ne doit pas faire perdre les autres : on la
        // signale nommément et on poursuit le lot.
        try {
          if (!main) {
            main = await fileToResizedDataUrl(file, MAIN_SIZE, MAIN_MAX_BYTES);
          } else {
            extra.push(await fileToResizedDataUrl(file, EXTRA_SIZE, EXTRA_MAX_BYTES));
          }
        } catch (e) {
          problems.push(`« ${file.name} » : ${e instanceof Error ? e.message : 'image invalide'}`);
        }
      }

      onChange({ photoUrl: main, photos: extra });
      setError(problems.join('\n'));
    } finally {
      setBusy(false);
    }
  }

  /** Une photo secondaire devient la principale (l'ancienne repart en secondaire). */
  function promote(index: number) {
    const extra = [...photos];
    const [picked] = extra.splice(index, 1);
    if (photoUrl) extra.unshift(photoUrl);
    onChange({ photoUrl: picked, photos: extra.slice(0, MAX_PRODUCT_PHOTOS) });
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void ingest(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Zone principale : dépôt, aperçu, remplacement */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files) void ingest(e.dataTransfer.files);
        }}
        className={`relative grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-xl border-2 border-dashed transition ${
          dragging ? 'border-primary bg-primary-soft' : 'border-line bg-surface-2'
        }`}
      >
        {photoUrl ? (
          <>
            <img src={photoUrl} alt="Photo principale" className="h-full w-full object-contain" />
            <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1.5 bg-gradient-to-t from-black/60 to-transparent p-2">
              <button
                type="button"
                onClick={() => setZoom(photoUrl)}
                className="rounded-lg bg-white/90 px-2 py-1 text-xs font-medium text-slate-900 hover:bg-white"
              >
                <ZoomIn className="inline h-3.5 w-3.5" /> Zoom
              </button>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded-lg bg-white/90 px-2 py-1 text-xs font-medium text-slate-900 hover:bg-white"
              >
                Remplacer
              </button>
              <button
                type="button"
                onClick={() => onChange({ photoUrl: photos[0] ?? '', photos: photos.slice(1) })}
                className="rounded-lg bg-white/90 px-2 py-1 text-xs font-medium text-danger hover:bg-white"
              >
                <Trash2 className="inline h-3.5 w-3.5" />
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center gap-2 p-6 text-center"
          >
            {busy ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : (
              <ImagePlus className="h-8 w-8 text-primary" />
            )}
            <span className="text-sm font-medium text-content">Photo du produit</span>
            <span className="text-xs text-content-faint">
              Glissez une image ici ou cliquez pour choisir
            </span>
          </button>
        )}
      </div>

      {/* Photos secondaires */}
      <div className="mt-2 flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <div key={i} className="group relative h-16 w-16 overflow-hidden rounded-lg border bg-surface-2">
            <img src={p} alt={`Photo ${i + 2}`} className="h-full w-full object-cover" />
            <div className="absolute inset-0 hidden items-center justify-center gap-1 bg-black/50 group-hover:flex">
              <button
                type="button"
                title="Définir comme photo principale"
                onClick={() => promote(i)}
                className="rounded bg-white/90 p-1 text-slate-900"
              >
                <Star className="h-3 w-3" />
              </button>
              <button
                type="button"
                title="Agrandir"
                onClick={() => setZoom(p)}
                className="rounded bg-white/90 p-1 text-slate-900"
              >
                <ZoomIn className="h-3 w-3" />
              </button>
              <button
                type="button"
                title="Retirer"
                onClick={() => onChange({ photoUrl, photos: photos.filter((_, j) => j !== i) })}
                className="rounded bg-white/90 p-1 text-danger"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
        {photoUrl && remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="grid h-16 w-16 place-items-center rounded-lg border-2 border-dashed border-line text-content-faint transition hover:border-primary hover:text-primary"
            title={`Ajouter une photo (${remaining} restante(s))`}
          >
            <ImagePlus className="h-4 w-4" />
          </button>
        )}
      </div>

      {error && (
        <p className="mt-1.5 whitespace-pre-line text-xs text-danger">{error}</p>
      )}

      {zoom && (
        <Modal open onClose={() => setZoom(null)} title="Aperçu" size="lg">
          <img src={zoom} alt="Aperçu agrandi" className="max-h-[70vh] w-full object-contain" />
        </Modal>
      )}
    </div>
  );
}
