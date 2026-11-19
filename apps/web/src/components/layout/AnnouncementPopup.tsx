import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ANNOUNCEMENT_KIND_LABELS } from '@oculo/shared-types';
import {
  getAnnouncementPopups,
  markAnnouncementPopupShown,
  markAnnouncementRead,
} from '../../features/announcements/api';
import { Badge, Button } from '../ui';
import { displayLocale } from '../../lib/format';
import { useAuthStore } from '../../store/auth';

/** « Plus tard » : ne plus rouvrir pendant cette session (effacé à la déconnexion). */
const LATER_KEY = 'oculo_popup_later';

function laterFor(userId: string | undefined): boolean {
  try {
    return !!userId && sessionStorage.getItem(LATER_KEY) === userId;
  } catch {
    return false;
  }
}

/**
 * Annonces non lues ouvertes d'elles-mêmes, pour qu'elles soient vraiment lues.
 *
 * Elles s'ouvrent à CHAQUE connexion (nouvelle session du navigateur ou de
 * l'application, ou après une reconnexion) tant que la personne n'a pas cliqué
 * « J'ai lu ». « Plus tard » les range jusqu'à la prochaine connexion. Plusieurs
 * annonces non lues passent l'une après l'autre.
 */
export function AnnouncementPopup() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  // Écran verrouillé : on attend le déverrouillage.
  const locked = useAuthStore((s) => s.locked);
  const [dismissed, setDismissed] = useState(() => laterFor(userId));
  const [readIds, setReadIds] = useState<string[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => setDismissed(laterFor(userId)), [userId]);

  const { data: queue } = useQuery({
    queryKey: ['announcement-popup', userId],
    queryFn: getAnnouncementPopups,
    enabled: !!userId && !dismissed,
    // Une seule demande par session : la file ne bouge plus ensuite.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const pending = (queue ?? []).filter((a) => !readIds.includes(a.id));
  const current = pending[Math.min(active, pending.length - 1)] ?? null;

  const shownMut = useMutation({ mutationFn: markAnnouncementPopupShown });
  const readMut = useMutation({
    mutationFn: markAnnouncementRead,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['announcements-unread'] });
      qc.invalidateQueries({ queryKey: ['announcements'] });
    },
  });

  const currentId = current?.id;
  useEffect(() => {
    if (currentId && !dismissed && !locked) shownMut.mutate(currentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, dismissed, locked]);

  if (!current || dismissed || locked) return null;

  function read() {
    if (!current) return;
    readMut.mutate(current.id);
    setReadIds((ids) => [...ids, current.id]);
    setActive(0);
  }

  function later() {
    try {
      if (userId) sessionStorage.setItem(LATER_KEY, userId);
    } catch {
      /* stockage indisponible : fermé pour cet écran seulement */
    }
    setDismissed(true);
  }

  const kind = i18n.exists(`announcementKinds.${current.kind}`)
    ? t(`announcementKinds.${current.kind}`)
    : ANNOUNCEMENT_KIND_LABELS[current.kind];
  const [cover, ...more] = current.images;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto overscroll-contain bg-black/60 p-2 backdrop-blur-sm sm:p-4">
      <div
        className="card card-modal my-auto w-full max-w-xl min-w-0 animate-fade-in overflow-hidden p-0"
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-popup-title"
      >
        {cover && (
          <a href={cover} target="_blank" rel="noopener noreferrer" className="block bg-surface-2">
            <img src={cover} alt="" className="mx-auto max-h-[32vh] w-full object-contain" />
          </a>
        )}
        <div className="px-4 py-4 sm:px-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex flex-wrap items-center gap-1.5 text-xs text-content-faint">
              <Megaphone className="h-4 w-4 text-primary" aria-hidden="true" />
              <Badge tone={current.kind === 'FIX' ? 'success' : current.kind === 'IMPROVEMENT' ? 'accent' : 'info'}>
                {kind}
              </Badge>
              {current.publishedAt && new Date(current.publishedAt).toLocaleDateString(displayLocale())}
              {pending.length > 1 && <span>· 1 / {pending.length}</span>}
            </span>
            <button
              type="button"
              onClick={later}
              className="btn-ghost h-8 w-8 rounded-lg p-0"
              aria-label={t('shell.popupLater')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <h2 id="announcement-popup-title" className="font-display text-lg font-bold text-content">
            {current.title}
          </h2>
          <p className="mt-2 max-h-[28vh] overflow-auto whitespace-pre-wrap text-sm text-content-muted">
            {current.body}
          </p>
          {more.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {more.map((url) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt="" className="h-20 w-full rounded-lg border object-cover" loading="lazy" />
                </a>
              ))}
            </div>
          )}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={later}>
              {t('shell.popupLater')}
            </Button>
            <Button onClick={read}>{t('shell.popupRead')}</Button>
          </div>
          <p className="mt-2 text-right text-xs text-content-faint">{t('shell.popupHint')}</p>
        </div>
      </div>
    </div>
  );
}
