import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, X } from 'lucide-react';
import { ANNOUNCEMENT_KIND_LABELS } from '@oculo/shared-types';
import {
  announcementsUnreadCount,
  listAnnouncements,
  markAllAnnouncementsRead,
  markAnnouncementRead,
  type Announcement,
} from '../../features/announcements/api';
import { Badge, Button } from '../ui';

/**
 * Nouveautés produit, côté utilisateur.
 *
 * Le compteur est chargé en permanence (une requête légère), la liste seulement
 * à l'ouverture : personne n'a besoin du contenu des annonces tant qu'il ne
 * clique pas. Une annonce est marquée lue quand elle est dépliée — pas à
 * l'ouverture du panneau, sinon tout passerait « lu » sans avoir été regardé.
 */
export function WhatsNewBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const { data: unread = 0 } = useQuery({
    queryKey: ['announcements-unread'],
    queryFn: announcementsUnreadCount,
    // Une nouveauté n'est pas urgente : inutile d'interroger le serveur souvent.
    staleTime: 5 * 60_000,
  });

  const { data: announcements, isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: listAnnouncements,
    enabled: open,
  });

  const readMut = useMutation({
    mutationFn: markAnnouncementRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements-unread'] });
      qc.invalidateQueries({ queryKey: ['announcements'] });
    },
  });

  const readAllMut = useMutation({
    mutationFn: markAllAnnouncementsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements-unread'] });
      qc.invalidateQueries({ queryKey: ['announcements'] });
    },
  });

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function toggle(a: Announcement) {
    const next = expanded === a.id ? null : a.id;
    setExpanded(next);
    if (next && !a.read) readMut.mutate(a.id);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn-ghost relative h-9 w-9 rounded-xl p-0 text-content-muted hover:text-content"
        aria-label={unread > 0 ? `Nouveautés, ${unread} non lues` : 'Nouveautés'}
        aria-expanded={open}
      >
        <Megaphone className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 max-h-[70vh] w-[min(92vw,26rem)] overflow-auto rounded-2xl border bg-surface shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b p-3">
            <p className="font-display font-bold text-content">Nouveautés</p>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <Button variant="ghost" onClick={() => readAllMut.mutate()} loading={readAllMut.isPending}>
                  Tout marquer comme lu
                </Button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-ghost h-7 w-7 rounded-lg p-0"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {isLoading ? (
            <p className="p-6 text-center text-sm text-content-muted">Chargement…</p>
          ) : !announcements || announcements.length === 0 ? (
            <p className="p-6 text-center text-sm text-content-muted">
              Aucune nouveauté pour le moment.
            </p>
          ) : (
            <ul className="divide-y">
              {announcements.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => toggle(a)}
                    className="flex w-full items-start gap-3 p-3 text-left hover:bg-surface-2"
                  >
                    {a.images[0] && (
                      <img
                        src={a.images[0]}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-lg object-cover"
                        loading="lazy"
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="mb-1 flex flex-wrap items-center gap-1.5">
                        <Badge tone={a.kind === 'FIX' ? 'success' : a.kind === 'IMPROVEMENT' ? 'accent' : 'info'}>
                          {ANNOUNCEMENT_KIND_LABELS[a.kind]}
                        </Badge>
                        {!a.read && <span className="h-2 w-2 rounded-full bg-danger" aria-label="Non lue" />}
                      </span>
                      <span className="block font-medium text-content">{a.title}</span>
                      <span className="block text-xs text-content-faint">
                        {a.publishedAt && new Date(a.publishedAt).toLocaleDateString('fr-FR')}
                      </span>
                    </span>
                  </button>

                  {expanded === a.id && (
                    <div className="px-3 pb-3">
                      <p className="whitespace-pre-wrap text-sm text-content-muted">{a.body}</p>
                      {a.images.length > 0 && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {a.images.map((url) => (
                            <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                              <img
                                src={url}
                                alt=""
                                className="w-full rounded-lg border object-cover"
                                loading="lazy"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
