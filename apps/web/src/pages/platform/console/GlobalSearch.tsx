import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, CreditCard, Receipt, Search, Users, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge, Spinner } from '../../../components/ui';
import { formatCurrency } from '../../../lib/format';
import {
  SUB_STATE_META,
  searchPlatform,
  type SearchResults,
} from '../../../features/billing/console';

/**
 * Recherche transversale de la console (§27).
 *
 * Trois choix qui changent l'usage au quotidien :
 *
 *  - la requête est débattue à 300 ms. Sans cela, chaque frappe part au serveur
 *    et les réponses reviennent dans le désordre : on voit le résultat d'une
 *    recherche déjà corrigée ;
 *  - rien n'est cherché en dessous de deux caractères, parce qu'une lettre
 *    ramène tout et n'apprend rien ;
 *  - chaque groupe annonce son total réel. « 5 sur 38 » se lit ; cinq lignes
 *    sans contexte laissent croire qu'il n'y en a que cinq.
 */
export function GlobalSearch({
  onClose,
  onPickTenant,
  onPickUser,
  onPickInvoice,
}: {
  onClose: () => void;
  onPickTenant: (tenantId: string) => void;
  onPickUser: (userId: string, tenantId: string) => void;
  onPickInvoice: (invoiceId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { data, isFetching } = useQuery({
    queryKey: ['platform-search', debounced],
    queryFn: () => searchPlatform(debounced),
    enabled: debounced.length >= 2,
  });

  const empty =
    data &&
    data.users.length === 0 &&
    data.tenants.length === 0 &&
    data.invoices.length === 0 &&
    data.payments.length === 0;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-black/60 p-4 pt-[8vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-2xl overflow-hidden p-0 shadow-card-lg"
        role="dialog"
        aria-modal="true"
        aria-label="Recherche"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-content-faint" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-sm text-content outline-none placeholder:text-content-faint"
            placeholder="Rechercher un établissement, utilisateur, facture…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {isFetching && <Spinner className="h-4 w-4" />}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la recherche"
            className="rounded-lg p-1 text-content-faint hover:text-content"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {debounced.length < 2 ? (
            <p className="px-4 py-8 text-center text-sm text-content-muted">
              Tapez au moins deux caractères — nom, e-mail, téléphone, numéro de facture ou
              référence de paiement.
            </p>
          ) : empty ? (
            <p className="px-4 py-8 text-center text-sm text-content-muted">
              Aucun résultat pour « {debounced} ».
            </p>
          ) : (
            <Results
              data={data}
              onPickTenant={(id) => {
                onPickTenant(id);
                onClose();
              }}
              onPickUser={(id, tenantId) => {
                onPickUser(id, tenantId);
                onClose();
              }}
              onPickInvoice={(id) => {
                onPickInvoice(id);
                onClose();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Results({
  data,
  onPickTenant,
  onPickUser,
  onPickInvoice,
}: {
  data: SearchResults | undefined;
  onPickTenant: (id: string) => void;
  onPickUser: (id: string, tenantId: string) => void;
  onPickInvoice: (id: string) => void;
}) {
  if (!data) return null;

  return (
    <div className="py-1">
      <Group
        icon={Building2}
        label="Établissements"
        shown={data.tenants.length}
        total={data.totals.tenants}
      >
        {data.tenants.map((t) => (
          <Row key={t.id} onClick={() => onPickTenant(t.id)}>
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium text-content">{t.name}</span>
              <span className="ml-2 text-xs text-content-faint">{t.planName ?? 'Sans offre'}</span>
            </span>
            {t.state && (
              <Badge tone={SUB_STATE_META[t.state].tone}>{SUB_STATE_META[t.state].label}</Badge>
            )}
          </Row>
        ))}
      </Group>

      <Group icon={Users} label="Utilisateurs" shown={data.users.length} total={data.totals.users}>
        {data.users.map((u) => (
          <Row key={u.id} onClick={() => onPickUser(u.id, u.tenantId)}>
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium text-content">{u.name}</span>
              <span className="ml-2 text-xs text-content-faint">{u.email}</span>
            </span>
            <span className="shrink-0 text-xs text-content-muted">{u.tenantName}</span>
          </Row>
        ))}
      </Group>

      <Group icon={Receipt} label="Factures" shown={data.invoices.length} total={data.totals.invoices}>
        {data.invoices.map((i) => (
          <Row key={i.id} onClick={() => onPickInvoice(i.id)}>
            <span className="min-w-0 flex-1 truncate">
              <span className="font-mono text-xs font-semibold text-primary">{i.number}</span>
              <span className="ml-2 text-xs text-content-faint">{i.tenantName}</span>
            </span>
            <span className="shrink-0 text-xs font-semibold text-content">
              {formatCurrency(i.total)}
            </span>
          </Row>
        ))}
      </Group>

      <Group
        icon={CreditCard}
        label="Paiements"
        shown={data.payments.length}
        total={data.totals.payments}
      >
        {data.payments.map((p) => (
          <Row key={p.id} onClick={() => onPickInvoice(p.invoiceId)}>
            <span className="min-w-0 flex-1 truncate">
              <span className="font-mono text-xs text-content">{p.reference ?? '—'}</span>
              <span className="ml-2 text-xs text-content-faint">{p.tenantName}</span>
            </span>
            <span className="shrink-0 text-xs font-semibold text-content">
              {formatCurrency(p.amount)}
            </span>
          </Row>
        ))}
      </Group>
    </div>
  );
}

function Group({
  icon: Icon,
  label,
  shown,
  total,
  children,
}: {
  icon: LucideIcon;
  label: string;
  shown: number;
  total?: number;
  children: React.ReactNode;
}) {
  if (shown === 0) return null;
  return (
    <section className="border-b last:border-0">
      <div className="flex items-center gap-1.5 px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-content-faint">
        <Icon className="h-3.5 w-3.5" />
        {label}
        {total != null && total > shown && (
          <span className="font-normal normal-case text-content-faint">
            — {shown} affichés sur {total}
          </span>
        )}
      </div>
      <ul className="pb-2">{children}</ul>
    </section>
  );
}

function Row({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-surface-2"
      >
        {children}
      </button>
    </li>
  );
}
