import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ANNOUNCEMENT_KIND_LABELS } from '@oculo/shared-types';
import {
  getAnnouncementPopup,
  markAnnouncementPopupShown,
  markAnnouncementRead,
  type Announcement,
} from '../../features/announcements/api';
import { Badge, Button } from '../ui';
import { displayLocale } from '../../lib/format';
import { useAuthStore } from '../../store/auth';

/**
 * Annonce non lue ouverte d'elle-même, pour qu'elle soit vraiment vue.
 *
 * Le serveur décide quand (2 fois par jour au plus, à 4 h d'écart, 6 fois en
 * tout) ; ici on se contente de demander régulièrement, l'application restant
 * souvent ouverte toute la journée en magasin. « J'ai lu » l'arrête pour de bon,
 * « Plus tard » la laisse revenir au prochain créneau.
 */
export function AnnouncementPopup() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [current, setCurrent] = useState<(Announcement & { remaining: number }) | null>(null);
  // Écran verrouillé : on attend le déverrouillage (sinon l'affichage compterait sans être vu).
  const locked = useAuthStore((s) => s.locked);

  const { data } = useQuery({
    queryKey: ['announcement-popup'],
    queryFn: getAnnouncementPopup,
    enabled: !locked,
    staleTime: 10 * 60_000,
    refetchInterval: 30 * 60_000,
  });

  const shownMut = useMutation({ mutationFn: markAnnouncementPopupShown });
  const readMut = useMutation({
    mutationFn: markAnnouncementRead,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['announcements-unread'] });
      qc.invalidateQueries({ queryKey: ['announcements'] });
    },
  });

  useEffect(() => {
    if (data && !current) {
      setCurrent(data);
      shownMut.mutate(data.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!current || locked) return null;

  function close(read: boolean) {
    if (read && current) readMut.mutate(current.id);
    setCurrent(null);
    qc.invalidateQueries({ queryKey: ['announcement-popup'] });
  }

  const kind = i18n.exists(`announcementKinds.${current.kind}`)
    ? t(`announcementKinds.${current.kind}`)
    : ANNOUNCEMENT_KIND_LABELS[current.kind];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-black/60 p-2 backdrop-blur-sm sm:p-4">
      <div
        className="card card-modal my-auto w-full max-w-lg min-w-0 animate-fade-in overflow-hidden p-0"
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-popup-title"
      >
        {current.images[0] && (
          <img src={current.images[0]} alt="" className="max-h-72 w-full bg-surface-2 object-contain" />
        )}
        <div className="px-4 py-4 sm:px-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex flex-wrap items-center gap-1.5 text-xs text-content-faint">
              <Megaphone className="h-4 w-4 text-primary" aria-hidden="true" />
              <Badge tone={current.kind === 'FIX' ? 'success' : current.kind === 'IMPROVEMENT' ? 'accent' : 'info'}>
                {kind}
              </Badge>
              {current.publishedAt && new Date(current.publishedAt).toLocaleDateString(displayLocale())}
            </span>
            <button
              type="button"
              onClick={() => close(false)}
              className="btn-ghost h-8 w-8 rounded-lg p-0"
              aria-label={t('shell.popupLater')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <h2 id="announcement-popup-title" className="font-display text-lg font-bold text-content">
            {current.title}
          </h2>
          <p className="mt-2 max-h-[40vh] overflow-auto whitespace-pre-wrap text-sm text-content-muted">
            {current.body}
          </p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => close(false)}>
              {t('shell.popupLater')}
            </Button>
            <Button onClick={() => close(true)}>{t('shell.popupRead')}</Button>
          </div>
          {current.remaining > 0 && (
            <p className="mt-2 text-right text-xs text-content-faint">{t('shell.popupHint')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
