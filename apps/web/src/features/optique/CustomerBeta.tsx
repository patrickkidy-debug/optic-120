import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, FileImage, Loader2, MessageSquareText, Trash2, UserCheck, Users } from 'lucide-react';
import { api, apiErrorMessage } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/format';
import { uploadImageToSupabase } from '../../lib/image';
import { useUIStore } from '../../store/ui';
import { usePermission } from '../../store/auth';
import { useToast } from '../../components/Toast';
import { Badge, Button } from '../../components/ui';

/**
 * Fiche client enrichie (bêta) : civilité, famille, refus des messages,
 * décès, liste « en cours », commentaires et documents joints.
 * Textes en français seulement tant que c'est en bêta (voir lib/beta.ts).
 */

export const CIVILITIES = [
  { value: 'M', label: 'Monsieur' },
  { value: 'MME', label: 'Madame' },
  { value: 'MLLE', label: 'Mademoiselle' },
  { value: 'ENFANT', label: 'Enfant' },
] as const;

export function civilityLabel(v?: string | null): string | null {
  return CIVILITIES.find((c) => c.value === v)?.label ?? null;
}

interface WaitingCustomer {
  id: string;
  firstName: string;
  lastName: string;
  civility?: string | null;
  phone?: string | null;
  waitingSince: string;
}
interface FamilyMember {
  id: string;
  firstName: string;
  lastName: string;
  civility?: string | null;
  dateOfBirth?: string | null;
  phone?: string | null;
}
interface CustomerComment {
  id: string;
  body: string;
  authorName?: string | null;
  createdAt: string;
}
interface CustomerDocument {
  id: string;
  name: string;
  url: string;
  createdAt: string;
}

/* --------------------------------- En cours --------------------------------- */

/** Bascule « client en cours » (présent au magasin, en attente). */
export function WaitingToggle({ customerId, waitingSince }: { customerId: string; waitingSince?: string | null }) {
  const qc = useQueryClient();
  const toast = useToast();
  const waiting = Boolean(waitingSince);
  const mut = useMutation({
    mutationFn: () => api.post(`/customers/${customerId}/waiting`, { waiting: !waiting }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['customer', customerId] });
      void qc.invalidateQueries({ queryKey: ['customers-waiting'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  return (
    <Button variant={waiting ? 'accent' : 'outline'} className="h-9 px-3 text-sm" loading={mut.isPending} onClick={() => mut.mutate()}>
      <Clock className="h-4 w-4" /> {waiting ? 'En cours · terminer' : 'Mettre en cours'}
    </Button>
  );
}

/** Liste des clients en cours, en haut de la page Clients. */
export function WaitingPanel({ onOpen }: { onOpen: (id: string) => void }) {
  const branchId = useUIStore((s) => s.activeBranchId);
  const { data } = useQuery({
    queryKey: ['customers-waiting', branchId],
    queryFn: async () => {
      const { data } = await api.get('/customers/waiting', { params: { branchId: branchId ?? undefined } });
      return data.customers as WaitingCustomer[];
    },
    refetchInterval: 60_000,
  });
  if (!data || data.length === 0) return null;
  return (
    <div className="mb-4 rounded-2xl border border-accent/30 bg-accent/5 p-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-content">
        <UserCheck className="h-4 w-4 text-accent" /> Clients en cours ({data.length})
      </p>
      <div className="flex flex-wrap gap-2">
        {data.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onOpen(c.id)}
            className="rounded-xl border bg-surface px-3 py-1.5 text-left text-sm transition hover:border-primary"
          >
            <span className="font-medium text-content">
              {civilityLabel(c.civility) ? `${civilityLabel(c.civility)} ` : ''}
              {c.firstName} {c.lastName}
            </span>
            <span className="ml-2 text-xs text-content-faint">depuis {formatDateTime(c.waitingSince).slice(-5)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- Famille --------------------------------- */

export function FamilyTab({ customerId, familyNumber, onOpen }: { customerId: string; familyNumber?: string | null; onOpen?: (id: string) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['customer-family', customerId],
    queryFn: async () => (await api.get(`/customers/${customerId}/family`)).data.members as FamilyMember[],
    enabled: Boolean(familyNumber),
  });
  if (!familyNumber) {
    return <p className="text-sm text-content-muted">Aucun numéro de famille. Ajoutez-en un dans « Modifier » pour regrouper parents et enfants.</p>;
  }
  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  return (
    <div className="space-y-2">
      <p className="text-sm text-content-muted">
        Famille n° <b className="text-content">{familyNumber}</b>
      </p>
      {data && data.length > 0 ? (
        data.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onOpen?.(m.id)}
            className="flex w-full items-center justify-between rounded-xl border bg-surface px-3 py-2 text-left text-sm hover:border-primary"
          >
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="font-medium text-content">{m.firstName} {m.lastName}</span>
              {m.civility && <Badge tone="neutral">{civilityLabel(m.civility)}</Badge>}
            </span>
            <span className="text-xs text-content-faint">{m.dateOfBirth ? formatDate(m.dateOfBirth) : m.phone ?? ''}</span>
          </button>
        ))
      ) : (
        <p className="text-sm text-content-muted">Aucun autre membre avec ce numéro.</p>
      )}
    </div>
  );
}

/* ------------------------------- Commentaires ------------------------------- */

export function CommentsTab({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const canEdit = usePermission('optique.customers.update');
  const [body, setBody] = useState('');
  const key = ['customer-comments', customerId];
  const { data } = useQuery({
    queryKey: key,
    queryFn: async () => (await api.get(`/customers/${customerId}/comments`)).data.comments as CustomerComment[],
  });
  const add = useMutation({
    mutationFn: () => api.post(`/customers/${customerId}/comments`, { body }),
    onSuccess: () => {
      setBody('');
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/customers/${customerId}/comments/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
  });
  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex gap-2">
          <textarea
            className="input min-h-[60px] flex-1"
            placeholder="Ajouter un commentaire (préférences, échange avec le client…)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <Button disabled={!body.trim()} loading={add.isPending} onClick={() => add.mutate()}>
            Ajouter
          </Button>
        </div>
      )}
      {data && data.length > 0 ? (
        <ul className="space-y-2">
          {data.map((c) => (
            <li key={c.id} className="rounded-xl border bg-surface px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <p className="whitespace-pre-wrap text-sm text-content">{c.body}</p>
                {canEdit && (
                  <button type="button" className="text-content-faint hover:text-danger" onClick={() => del.mutate(c.id)} aria-label="Supprimer">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-content-faint">
                {formatDateTime(c.createdAt)}
                {c.authorName ? ` · ${c.authorName}` : ''}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-sm text-content-muted">
          <MessageSquareText className="h-4 w-4" /> Aucun commentaire.
        </p>
      )}
    </div>
  );
}

/* -------------------------------- Documents -------------------------------- */

export function DocumentsTab({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const canEdit = usePermission('optique.customers.update');
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const key = ['customer-documents', customerId];
  const { data } = useQuery({
    queryKey: key,
    queryFn: async () => (await api.get(`/customers/${customerId}/documents`)).data.documents as CustomerDocument[],
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/customers/${customerId}/documents/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
  });

  async function upload(file: File) {
    setBusy(true);
    try {
      const url = await uploadImageToSupabase(file, 'documents-clients', 1600, 900 * 1024);
      await api.post(`/customers/${customerId}/documents`, { name: file.name.replace(/\.[^.]+$/, '').slice(0, 120) || 'Document', url });
      void qc.invalidateQueries({ queryKey: key });
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = '';
            }}
          />
          <Button variant="outline" loading={busy} onClick={() => fileRef.current?.click()}>
            <FileImage className="h-4 w-4" /> Joindre un document (photo ou scan)
          </Button>
        </>
      )}
      {data && data.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {data.map((d) => (
            <div key={d.id} className="group overflow-hidden rounded-xl border bg-surface">
              <a href={d.url} target="_blank" rel="noopener noreferrer" className="block aspect-[4/3] bg-surface-2">
                <img src={d.url} alt={d.name} className="h-full w-full object-cover" loading="lazy" />
              </a>
              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-content">{d.name}</span>
                  <span className="text-[11px] text-content-faint">{formatDate(d.createdAt)}</span>
                </span>
                {canEdit && (
                  <button type="button" className="text-content-faint hover:text-danger" onClick={() => del.mutate(d.id)} aria-label="Supprimer">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-content-muted">Aucun document joint.</p>
      )}
    </div>
  );
}
