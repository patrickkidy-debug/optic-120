import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  ImagePlus,
  Linkedin,
  MessageCircle,
  Plus,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import {
  ANNOUNCEMENT_KIND_LABELS,
  ANNOUNCEMENT_MAX_IMAGES,
  ANNOUNCEMENT_KINDS,
  defaultAnnouncementLinkedin,
  defaultAnnouncementWhatsapp,
  type AnnouncementKind,
} from '@oculo/shared-types';
import {
  createAnnouncement,
  deleteAnnouncement,
  getNotifiedTenants,
  listAllAnnouncements,
  markTenantNotified,
  publishAnnouncement,
  updateAnnouncement,
  type Announcement,
} from '../../features/announcements/api';
import { listAllSubscriptions } from '../../features/billing/api';
import { uploadImageToSupabase } from '../../lib/image';
import { waLink } from '../../lib/whatsapp';
import { apiErrorMessage } from '../../lib/api';
import { Badge, Button, EmptyState, Field, PageLoader } from '../../components/ui';

const KIND_TONE: Record<AnnouncementKind, 'info' | 'accent' | 'success'> = {
  FEATURE: 'info',
  IMPROVEMENT: 'accent',
  FIX: 'success',
};

/** Annonces qui ne concernent plus personne : inutile d'y diffuser. */
const INACTIVE_STATUSES = ['CANCELLED'];

/**
 * Nouveautés : rédaction, publication in-app et diffusion.
 *
 * Deux canaux, deux réalités techniques assumées :
 *  - WhatsApp n'accepte qu'un lien wa.me, donc du TEXTE vers UN destinataire à
 *    la fois. L'image ne peut pas être jointe : elle part en lien, dont
 *    WhatsApp fait un aperçu. D'où un bouton par établissement, plus un bouton
 *    « copier » pour une liste de diffusion créée dans WhatsApp.
 *  - LinkedIn ne permet plus de pré-remplir le texte d'un post depuis une URL.
 *    On prépare donc le post et l'image, et la publication finale se fait dans
 *    LinkedIn. Prétendre publier automatiquement demanderait l'API LinkedIn.
 */
export function AnnouncementsTab() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: announcements, isLoading } = useQuery({
    queryKey: ['platform-announcements'],
    queryFn: listAllAnnouncements,
  });

  const selected = announcements?.find((a) => a.id === selectedId) ?? null;

  const publishMut = useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) =>
      publishAnnouncement(id, published),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-announcements'] }),
    onError: (e) => alert(apiErrorMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: deleteAnnouncement,
    onSuccess: () => {
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ['platform-announcements'] });
    },
    onError: (e) => alert(apiErrorMessage(e)),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="max-w-2xl">
          <h3 className="font-display text-base font-bold text-content">Nouveautés produit</h3>
          <p className="mt-0.5 text-sm text-content-muted">
            Rédigez une nouveauté avec ses visuels, publiez-la dans l'application, puis diffusez-la sur
            WhatsApp et LinkedIn.
          </p>
        </div>
        <Button
          onClick={() => {
            setSelectedId(null);
            setCreating(true);
          }}
        >
          <Plus className="h-4 w-4" /> Nouvelle annonce
        </Button>
      </div>

      {creating && (
        <Editor
          onClose={() => setCreating(false)}
          onSaved={(a) => {
            setCreating(false);
            setSelectedId(a.id);
          }}
        />
      )}

      {!announcements || announcements.length === 0 ? (
        !creating && (
          <EmptyState
            icon={Send}
            title="Aucune annonce"
            hint="Créez votre première nouveauté pour informer vos utilisateurs."
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
          <div className="card divide-y overflow-hidden">
            {announcements.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setCreating(false);
                  setSelectedId(a.id === selectedId ? null : a.id);
                }}
                className={`flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-surface-2 ${
                  a.id === selectedId ? 'bg-surface-2' : ''
                }`}
              >
                {a.images[0] ? (
                  <img
                    src={a.images[0]}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-surface-3 text-content-faint">
                    <ImagePlus className="h-5 w-5" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="mb-1 flex flex-wrap items-center gap-1.5">
                    <Badge tone={KIND_TONE[a.kind]}>{ANNOUNCEMENT_KIND_LABELS[a.kind]}</Badge>
                    <Badge tone={a.publishedAt ? 'success' : 'neutral'}>
                      {a.publishedAt ? 'Publiée' : 'Brouillon'}
                    </Badge>
                  </span>
                  <span className="block truncate font-medium text-content">{a.title}</span>
                  <span className="block text-xs text-content-faint">
                    {new Date(a.publishedAt ?? a.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {selected ? (
              <>
                <div className="card flex flex-wrap items-center justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <h4 className="truncate font-display font-bold text-content">{selected.title}</h4>
                    <p className="text-xs text-content-faint">
                      {selected.publishedAt
                        ? `Publiée le ${new Date(selected.publishedAt).toLocaleDateString('fr-FR')} — visible par tous les utilisateurs`
                        : 'Brouillon — invisible pour vos utilisateurs'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={selected.publishedAt ? 'outline' : undefined}
                      loading={publishMut.isPending}
                      onClick={() =>
                        publishMut.mutate({ id: selected.id, published: !selected.publishedAt })
                      }
                    >
                      {selected.publishedAt ? (
                        <>
                          <EyeOff className="h-4 w-4" /> Dépublier
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4" /> Publier dans l'app
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Supprimer définitivement « ${selected.title} » ?`)) {
                          deleteMut.mutate(selected.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                </div>

                <Editor key={selected.id} existing={selected} onClose={() => setSelectedId(null)} />
                <Distribution announcement={selected} />
              </>
            ) : (
              <div className="card grid place-items-center p-10 text-center text-sm text-content-muted">
                Sélectionnez une annonce pour la modifier et la diffuser.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Rédaction --------------------------------- */

function Editor({
  existing,
  onClose,
  onSaved,
}: {
  existing?: Announcement;
  onClose: () => void;
  onSaved?: (a: Announcement) => void;
}) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<AnnouncementKind>(existing?.kind ?? 'FEATURE');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [images, setImages] = useState<string[]>(existing?.images ?? []);
  const [whatsappMessage, setWhatsappMessage] = useState(existing?.whatsappMessage ?? '');
  const [linkedinPost, setLinkedinPost] = useState(existing?.linkedinPost ?? '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Les textes de diffusion suivent le contenu tant qu'ils n'ont pas été
  // personnalisés : sans cela, corriger une faute dans le titre laisserait un
  // message WhatsApp obsolète, que personne ne penserait à relire.
  const autoWhatsapp = defaultAnnouncementWhatsapp(kind, title || '…', body || '…', images[0]);
  const autoLinkedin = defaultAnnouncementLinkedin(kind, title || '…', body || '…');

  const payload = {
    kind,
    title: title.trim(),
    body: body.trim(),
    images,
    whatsappMessage: whatsappMessage.trim(),
    linkedinPost: linkedinPost.trim(),
  };

  const saveMut = useMutation({
    mutationFn: () =>
      existing ? updateAnnouncement(existing.id, payload) : createAnnouncement(payload),
    onSuccess: (a) => {
      setError('');
      setSaved(true);
      qc.invalidateQueries({ queryKey: ['platform-announcements'] });
      onSaved?.(a);
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  async function addImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError('');
    try {
      const room = ANNOUNCEMENT_MAX_IMAGES - images.length;
      const picked = [...files].slice(0, Math.max(0, room));
      const urls = await Promise.all(picked.map((f) => uploadImageToSupabase(f, 'announcements', 1400)));
      setImages((prev) => [...prev, ...urls]);
      setSaved(false);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  const invalid = payload.title.length < 3 || payload.body.length < 10;

  return (
    <div className="card p-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <Field label="Type">
            <select
              className="input"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as AnnouncementKind);
                setSaved(false);
              }}
            >
              {ANNOUNCEMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {ANNOUNCEMENT_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Titre">
            <input
              className="input"
              value={title}
              maxLength={160}
              placeholder="Ex : Rapports & Analyses, entièrement repensés"
              onChange={(e) => {
                setTitle(e.target.value);
                setSaved(false);
              }}
            />
          </Field>

          <Field label="Description">
            <textarea
              className="input min-h-[140px]"
              value={body}
              maxLength={4000}
              placeholder="Ce qui change, et en quoi c'est utile au quotidien."
              onChange={(e) => {
                setBody(e.target.value);
                setSaved(false);
              }}
            />
          </Field>

          <div>
            <p className="mb-1.5 text-sm font-medium text-content">
              Visuels ({images.length}/{ANNOUNCEMENT_MAX_IMAGES})
            </p>
            <div className="flex flex-wrap gap-2">
              {images.map((url, i) => (
                <div key={url} className="relative">
                  <img src={url} alt="" className="h-20 w-28 rounded-lg border object-cover" />
                  {i === 0 && (
                    <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">
                      Principal
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setImages((prev) => prev.filter((u) => u !== url));
                      setSaved(false);
                    }}
                    className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-danger text-white"
                    aria-label="Retirer ce visuel"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {images.length < ANNOUNCEMENT_MAX_IMAGES && (
                <label className="grid h-20 w-28 cursor-pointer place-items-center rounded-lg border border-dashed text-content-faint hover:bg-surface-2">
                  {uploading ? (
                    <span className="text-xs">Envoi…</span>
                  ) : (
                    <>
                      <ImagePlus className="h-5 w-5" />
                      <span className="text-[11px]">Ajouter</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => void addImages(e.target.files)}
                  />
                </label>
              )}
            </div>
            <p className="mt-1 text-xs text-content-faint">
              Le premier visuel illustre l'aperçu WhatsApp et le post LinkedIn.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Field label="Message WhatsApp">
            <textarea
              className="input min-h-[150px] font-mono text-xs"
              value={whatsappMessage || autoWhatsapp}
              maxLength={1500}
              onChange={(e) => {
                setWhatsappMessage(e.target.value);
                setSaved(false);
              }}
            />
          </Field>
          <Field label="Post LinkedIn">
            <textarea
              className="input min-h-[150px] font-mono text-xs"
              value={linkedinPost || autoLinkedin}
              maxLength={3000}
              onChange={(e) => {
                setLinkedinPost(e.target.value);
                setSaved(false);
              }}
            />
          </Field>
          <p className="text-xs text-content-faint">
            Laissés tels quels, ces textes sont générés à partir du titre et de la description.
          </p>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={() => saveMut.mutate()} loading={saveMut.isPending} disabled={invalid}>
          {existing ? 'Enregistrer' : 'Créer le brouillon'}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Fermer
        </Button>
        {invalid && (
          <span className="text-xs text-content-faint">
            Un titre d'au moins 3 caractères et une description d'au moins 10 sont requis.
          </span>
        )}
        {saved && !saveMut.isPending && (
          <span className="inline-flex items-center gap-1 text-sm text-success">
            <Check className="h-4 w-4" /> Enregistré
          </span>
        )}
      </div>
    </div>
  );
}

/* -------------------------------- Diffusion -------------------------------- */

function Distribution({ announcement }: { announcement: Announcement }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState<'wa' | 'li' | null>(null);

  const { data: subs } = useQuery({ queryKey: ['platform-subs'], queryFn: listAllSubscriptions });
  const { data: notified } = useQuery({
    queryKey: ['platform-announcement-notified', announcement.id],
    queryFn: () => getNotifiedTenants(announcement.id),
  });

  const notifyMut = useMutation({
    mutationFn: (tenantId: string) => markTenantNotified(announcement.id, tenantId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['platform-announcement-notified', announcement.id] }),
  });

  const waText =
    announcement.whatsappMessage ||
    defaultAnnouncementWhatsapp(
      announcement.kind,
      announcement.title,
      announcement.body,
      announcement.images[0],
    );
  const liText =
    announcement.linkedinPost ||
    defaultAnnouncementLinkedin(announcement.kind, announcement.title, announcement.body);

  const done = useMemo(() => new Set(notified ?? []), [notified]);
  const targets = (subs ?? [])
    .filter((s) => !INACTIVE_STATUSES.includes(s.status))
    .filter((s) => s.tenantName.toLowerCase().includes(search.trim().toLowerCase()));

  async function copy(text: string, which: 'wa' | 'li') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, permission) : on le dit
      // plutôt que de laisser croire que le texte est copié.
      alert("Le navigateur a refusé l'accès au presse-papiers. Sélectionnez le texte et copiez-le manuellement.");
    }
  }

  function send(tenantId: string, phone: string | null) {
    const link = waLink(phone);
    if (!link) return;
    // Ouverture synchrone, dans le geste de clic, sinon le navigateur bloque.
    window.open(`${link}?text=${encodeURIComponent(waText)}`, '_blank', 'noopener,noreferrer');
    notifyMut.mutate(tenantId);
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-display font-bold text-content">
            <Linkedin className="mr-1.5 inline h-4 w-4 text-primary" aria-hidden="true" /> LinkedIn
          </h4>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void copy(liText, 'li')}>
              {copied === 'li' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied === 'li' ? 'Copié' : 'Copier le post'}
            </Button>
            {announcement.images[0] && (
              <Button
                variant="outline"
                onClick={() => window.open(announcement.images[0], '_blank', 'noopener,noreferrer')}
              >
                Ouvrir le visuel
              </Button>
            )}
            <Button
              onClick={() =>
                window.open(
                  'https://www.linkedin.com/feed/?shareActive=true',
                  '_blank',
                  'noopener,noreferrer',
                )
              }
            >
              Ouvrir LinkedIn
            </Button>
          </div>
        </div>
        <p className="text-xs text-content-faint">
          LinkedIn ne permet pas de pré-remplir un post depuis un lien : copiez le texte, ouvrez
          LinkedIn, collez-le et joignez le visuel. Une publication entièrement automatique
          nécessiterait l'API LinkedIn.
        </p>
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-xs text-content">
          {liText}
        </pre>
      </div>

      <div className="card p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-display font-bold text-content">
            <MessageCircle className="mr-1.5 inline h-4 w-4 text-primary" aria-hidden="true" /> WhatsApp
          </h4>
          <Button variant="outline" onClick={() => void copy(waText, 'wa')}>
            {copied === 'wa' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied === 'wa' ? 'Copié' : 'Copier le message'}
          </Button>
        </div>
        <p className="mb-3 text-xs text-content-faint">
          Un bouton par établissement ouvre WhatsApp avec le message prêt — l'image n'est pas jointe,
          elle part en lien avec aperçu. Pour un envoi groupé, copiez le message et collez-le dans une
          liste de diffusion créée dans WhatsApp.
        </p>

        <div className="relative mb-3 max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint"
            aria-hidden="true"
          />
          <input
            type="search"
            className="input pl-9"
            placeholder="Rechercher un établissement…"
            aria-label="Rechercher un établissement"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <p className="mb-2 text-xs text-content-muted">
          {done.size} sur {targets.length} établissement{targets.length > 1 ? 's' : ''} prévenu
          {done.size > 1 ? 's' : ''}
        </p>

        <div className="max-h-80 divide-y overflow-auto rounded-lg border">
          {targets.map((s) => {
            const hasPhone = Boolean(waLink(s.whatsapp));
            const already = done.has(s.tenantId);
            return (
              <div key={s.tenantId} className="flex items-center justify-between gap-2 p-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-content">{s.tenantName}</p>
                  <p className="text-xs text-content-faint">{s.whatsapp || 'Aucun numéro'}</p>
                </div>
                {hasPhone ? (
                  <Button
                    variant={already ? 'outline' : undefined}
                    onClick={() => send(s.tenantId, s.whatsapp)}
                  >
                    {already ? (
                      <>
                        <Check className="h-4 w-4" /> Prévenu
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" /> Envoyer
                      </>
                    )}
                  </Button>
                ) : (
                  <span className="text-xs text-content-faint">Pas de numéro</span>
                )}
              </div>
            );
          })}
          {targets.length === 0 && (
            <p className="p-3 text-center text-sm text-content-muted">Aucun établissement trouvé.</p>
          )}
        </div>
      </div>
    </div>
  );
}
