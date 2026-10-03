import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import type { AnomalyCategory } from '@oculo/shared-types';
import { listSales, getSale, listProducts, getStock, listLensOrders, listRepairs, type SaleDetailItem } from '../../features/optique/api';
import { listClaims, listRefunds } from '../../features/management/api';
import { getCurrentRegister } from '../../features/cashregister/api';
import { CustomerSearch } from '../../features/optique/SaleTools';
import { PageLoader } from '../../components/ui';
import { useUIStore } from '../../store/ui';
import { tr } from '../../lib/tr';
import { displayLocale, formatCurrency } from '../../lib/format';

export interface PickedTarget {
  id: string;
  reference: string;
  branchId: string | null;
  /** Valeurs actuelles résolues, une entrée par champ du registre de la catégorie. */
  current: Record<string, string>;
  /** Pour VENTE/DEVIS : les lignes actuelles, pour l'éditeur dédié. */
  saleItems?: SaleDetailItem[];
}

const money = (v: string | number | null) => (v == null ? '' : String(Math.round(Number(v))));

/** Liste filtrable minimale, motif commun à tous les sélecteurs de cible. */
function SearchList<T>({
  items,
  isLoading,
  renderRow,
  keyOf,
  placeholder,
  query,
  onQueryChange,
}: {
  items: T[];
  isLoading: boolean;
  renderRow: (item: T) => React.ReactNode;
  keyOf: (item: T) => string;
  placeholder: string;
  query: string;
  onQueryChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-faint" />
        <input className="input pl-9" placeholder={placeholder} value={query} onChange={(e) => onQueryChange(e.target.value)} autoFocus />
      </div>
      {isLoading ? (
        <PageLoader />
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-content-faint">{tr('ui.TargetPicker.aucunResultat')}</p>
      ) : (
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <div key={keyOf(item)}>{renderRow(item)}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ title, subtitle, onClick }: { title: string; subtitle?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col items-start rounded-lg border px-3 py-2 text-left text-sm transition hover:bg-surface-2"
    >
      <span className="font-medium text-content">{title}</span>
      {subtitle && <span className="text-xs text-content-faint">{subtitle}</span>}
    </button>
  );
}

export function TargetPicker({
  category,
  onPick,
}: {
  category: AnomalyCategory;
  onPick: (target: PickedTarget) => void;
}) {
  const [query, setQuery] = useState('');
  const branchId = useUIStore((s) => s.activeBranchId);

  if (category === 'VENTE' || category === 'DEVIS') {
    return <SalePicker type={category === 'DEVIS' ? 'QUOTE' : 'SALE'} query={query} setQuery={setQuery} onPick={onPick} />;
  }
  if (category === 'PRODUIT') {
    return <ProductPicker query={query} setQuery={setQuery} onPick={onPick} />;
  }
  if (category === 'STOCK') {
    return <StockPicker branchId={branchId} query={query} setQuery={setQuery} onPick={onPick} />;
  }
  if (category === 'CLIENT') {
    return (
      <CustomerSearch
        value={null}
        onChange={(id, c) => {
          if (!id || !c) return;
          onPick({
            id,
            reference: `${c.firstName} ${c.lastName}`,
            branchId: null,
            current: {
              firstName: c.firstName,
              lastName: c.lastName,
              phone: c.phone ?? '',
              email: c.email ?? '',
              loyaltyPoints: String(c.loyaltyPoints ?? 0),
            },
          });
        }}
      />
    );
  }
  if (category === 'COMMANDE_VERRES') {
    return <LensOrderPicker query={query} setQuery={setQuery} onPick={onPick} />;
  }
  if (category === 'SAV') {
    return <RepairPicker query={query} setQuery={setQuery} onPick={onPick} />;
  }
  if (category === 'CAISSE') {
    return <CashRegisterPicker branchId={branchId} onPick={onPick} />;
  }
  if (category === 'PAIEMENT') {
    return <PaymentPicker query={query} setQuery={setQuery} onPick={onPick} />;
  }
  if (category === 'ASSURANCE') {
    return <InsurancePicker query={query} setQuery={setQuery} onPick={onPick} />;
  }
  return null;
}

function SalePicker({
  type,
  query,
  setQuery,
  onPick,
}: {
  type: 'SALE' | 'QUOTE';
  query: string;
  setQuery: (v: string) => void;
  onPick: (t: PickedTarget) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['anomaly-target-sales', type, query],
    queryFn: () => listSales({ type, search: query || undefined, pageSize: 20 }),
  });
  return (
    <SearchList
      items={data?.items ?? []}
      isLoading={isLoading}
      query={query}
      onQueryChange={setQuery}
      placeholder={tr('ui.TargetPicker.numeroClientOuTelephone')}
      keyOf={(s) => s.id}
      renderRow={(s) => (
        <Row
          title={tr('ui.TargetPicker.numberValueFcfa', { number: s.number, value: formatCurrency(Number(s.totalAmount)) })}
          subtitle={s.customer ? `${s.customer.firstName} ${s.customer.lastName}` : tr('ui.TargetPicker.sansClient')}
          onClick={async () => {
            const full = await getSale(s.id);
            onPick({
              id: full.id,
              reference: full.number,
              branchId: null,
              saleItems: full.items,
              current: {
                items: JSON.stringify(
                  full.items.map((i) => ({
                    productId: i.productId,
                    productName: i.product?.name ?? '',
                    quantity: i.quantity,
                    unitPrice: Number(i.unitPrice),
                  })),
                ),
                discountAmount: money(full.discountAmount),
                insuranceAmount: money(full.insuranceAmount),
                insurerId: full.insurerId ?? '',
                customerId: full.customerId ?? '',
                vatRate: full.vatRate != null ? String(full.vatRate) : '0',
                createdAt: full.createdAt ? full.createdAt.slice(0, 16) : '',
                cashierId: full.cashierId ?? '',
              },
            });
          }}
        />
      )}
    />
  );
}

function ProductPicker({ query, setQuery, onPick }: { query: string; setQuery: (v: string) => void; onPick: (t: PickedTarget) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['anomaly-target-products', query],
    queryFn: () => listProducts({ search: query || undefined, pageSize: 20 }),
  });
  return (
    <SearchList
      items={data?.items ?? []}
      isLoading={isLoading}
      query={query}
      onQueryChange={setQuery}
      placeholder={tr('ui.TargetPicker.nomReferenceOuMarque')}
      keyOf={(p) => p.id}
      renderRow={(p) => (
        <Row
          title={p.name}
          subtitle={tr('ui.TargetPicker.skuValueFcfa', { sku: p.sku, value: formatCurrency(Number(p.sellPrice)) })}
          onClick={() =>
            onPick({
              id: p.id,
              reference: p.name,
              branchId: null,
              current: {
                sku: p.sku,
                category: p.category,
                brand: p.brand ?? '',
                name: p.name,
                buyPrice: money(p.buyPrice),
                sellPrice: money(p.sellPrice),
              },
            })
          }
        />
      )}
    />
  );
}

function StockPicker({
  branchId,
  query,
  setQuery,
  onPick,
}: {
  branchId: string | null;
  query: string;
  setQuery: (v: string) => void;
  onPick: (t: PickedTarget) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['anomaly-target-stock', branchId],
    queryFn: () => getStock(branchId!),
    enabled: Boolean(branchId),
  });
  const rows = (data ?? []).filter((r) => r.name.toLowerCase().includes(query.toLowerCase()) && r.stockItemId);
  return (
    <SearchList
      items={rows}
      isLoading={isLoading}
      query={query}
      onQueryChange={setQuery}
      placeholder={tr('ui.TargetPicker.nomDuProduit')}
      keyOf={(r) => r.stockItemId!}
      renderRow={(r) => (
        <Row
          title={r.name}
          subtitle={tr('ui.TargetPicker.stockSystemeQuantity', { quantity: r.quantity })}
          onClick={() =>
            onPick({
              id: r.stockItemId!,
              reference: r.name,
              branchId,
              current: { quantity: String(r.quantity) },
            })
          }
        />
      )}
    />
  );
}

function LensOrderPicker({ query, setQuery, onPick }: { query: string; setQuery: (v: string) => void; onPick: (t: PickedTarget) => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['anomaly-target-lens-orders'], queryFn: () => listLensOrders() });
  const rows = (data ?? []).filter(
    (o) => o.number.toLowerCase().includes(query.toLowerCase()) || o.description.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <SearchList
      items={rows}
      isLoading={isLoading}
      query={query}
      onQueryChange={setQuery}
      placeholder={tr('ui.TargetPicker.numeroOuDescription')}
      keyOf={(o) => o.id}
      renderRow={(o) => (
        <Row
          title={o.number}
          subtitle={o.description}
          onClick={() =>
            onPick({
              id: o.id,
              reference: o.number,
              branchId: null,
              current: {
                supplierName: o.supplierName ?? '',
                description: o.description,
                cost: money(o.cost),
                notes: o.notes ?? '',
              },
            })
          }
        />
      )}
    />
  );
}

function RepairPicker({ query, setQuery, onPick }: { query: string; setQuery: (v: string) => void; onPick: (t: PickedTarget) => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['anomaly-target-repairs'], queryFn: () => listRepairs() });
  const rows = (data ?? []).filter(
    (r) => r.number.toLowerCase().includes(query.toLowerCase()) || r.description.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <SearchList
      items={rows}
      isLoading={isLoading}
      query={query}
      onQueryChange={setQuery}
      placeholder={tr('ui.TargetPicker.numeroOuDescription')}
      keyOf={(r) => r.id}
      renderRow={(r) => (
        <Row
          title={r.number}
          subtitle={r.description}
          onClick={() =>
            onPick({
              id: r.id,
              reference: r.number,
              branchId: null,
              current: { description: r.description, cost: money(r.cost), notes: r.notes ?? '' },
            })
          }
        />
      )}
    />
  );
}

function CashRegisterPicker({ branchId, onPick }: { branchId: string | null; onPick: (t: PickedTarget) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['anomaly-target-cashregister', branchId],
    queryFn: () => getCurrentRegister(branchId!),
    enabled: Boolean(branchId),
  });
  if (isLoading) return <PageLoader />;
  if (!data) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-center text-sm text-content-faint">
        {tr('ui.TargetPicker.aucuneSessionDeCaisseOuverte')}
      </p>
    );
  }
  return (
    <Row
      title={tr('ui.TargetPicker.sessionOuverteLeValue', { value: new Date(data.openedAt).toLocaleString(displayLocale()) })}
      subtitle={tr('ui.TargetPicker.fondDeCaisseValueFcfa', { value: formatCurrency(Number(data.openingAmount)) })}
      onClick={() =>
        onPick({
          id: data.id,
          reference: tr('ui.TargetPicker.sessionDuValue', { value: new Date(data.openedAt).toLocaleDateString(displayLocale()) }),
          branchId,
          current: {
            openingAmount: money(data.openingAmount),
            closingAmount: money(data.closingAmount ?? null),
          },
        })
      }
    />
  );
}

function PaymentPicker({ query, setQuery, onPick }: { query: string; setQuery: (v: string) => void; onPick: (t: PickedTarget) => void }) {
  const [saleId, setSaleId] = useState<string | null>(null);
  const { data: sales, isLoading: loadingSales } = useQuery({
    queryKey: ['anomaly-target-payment-sales', query],
    queryFn: () => listSales({ search: query || undefined, pageSize: 20 }),
    enabled: !saleId,
  });
  const { data: sale, isLoading: loadingSale } = useQuery({
    queryKey: ['anomaly-target-payment-sale', saleId],
    queryFn: () => getSale(saleId!),
    enabled: Boolean(saleId),
  });

  if (!saleId) {
    return (
      <SearchList
        items={sales?.items ?? []}
        isLoading={loadingSales}
        query={query}
        onQueryChange={setQuery}
        placeholder={tr('ui.TargetPicker.trouvezDAbordLaVente')}
        keyOf={(s) => s.id}
        renderRow={(s) => (
          <Row
            title={tr('ui.TargetPicker.numberValueFcfa', { number: s.number, value: formatCurrency(Number(s.totalAmount)) })}
            subtitle={s.customer ? `${s.customer.firstName} ${s.customer.lastName}` : tr('ui.TargetPicker.sansClient')}
            onClick={() => setSaleId(s.id)}
          />
        )}
      />
    );
  }

  if (loadingSale || !sale) return <PageLoader />;
  const payments = (sale.payments ?? []).filter((p) => p.status === 'SUCCESS');

  return (
    <div>
      <button type="button" onClick={() => setSaleId(null)} className="mb-2 text-xs text-content-muted hover:text-content">
        {tr('ui.TargetPicker.choisirUneAutreVente')}
      </button>
      {payments.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-content-faint">
          {tr('ui.TargetPicker.aucunPaiementRegleSurCette')}
        </p>
      ) : (
        <div className="space-y-1">
          {payments.map((p) => (
            <Row
              key={p.id}
              title={tr('ui.TargetPicker.valueFcfaMethod', { value: formatCurrency(Number(p.amount)), method: p.method })}
              subtitle={new Date(p.createdAt).toLocaleString(displayLocale())}
              onClick={() =>
                onPick({
                  id: p.id,
                  reference: sale.number,
                  branchId: null,
                  current: { method: p.method, amount: money(p.amount) },
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InsurancePicker({ query, setQuery, onPick }: { query: string; setQuery: (v: string) => void; onPick: (t: PickedTarget) => void }) {
  const [mode, setMode] = useState<'CLAIM' | 'REFUND'>('CLAIM');
  const { data: claims, isLoading: loadingClaims } = useQuery({
    queryKey: ['anomaly-target-claims'],
    queryFn: () => listClaims(),
    enabled: mode === 'CLAIM',
  });
  const { data: refunds, isLoading: loadingRefunds } = useQuery({
    queryKey: ['anomaly-target-refunds'],
    queryFn: () => listRefunds(),
    enabled: mode === 'REFUND',
  });

  const claimRows = (claims ?? []).filter(
    (c) => c.number.toLowerCase().includes(query.toLowerCase()) || (c.insurer?.name ?? '').toLowerCase().includes(query.toLowerCase()),
  );
  const refundRows = (refunds?.refunds ?? []).filter((r) => (r.claim?.number ?? '').toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <div className="mb-3 inline-flex gap-1 rounded-lg border bg-surface p-1 text-xs">
        <button
          type="button"
          onClick={() => setMode('CLAIM')}
          className={`rounded-md px-2.5 py-1 font-semibold ${mode === 'CLAIM' ? 'bg-primary text-white' : 'text-content-muted'}`}
        >
          {tr('ui.TargetPicker.dossier')}
        </button>
        <button
          type="button"
          onClick={() => setMode('REFUND')}
          className={`rounded-md px-2.5 py-1 font-semibold ${mode === 'REFUND' ? 'bg-primary text-white' : 'text-content-muted'}`}
        >
          {tr('ui.TargetPicker.remboursement')}
        </button>
      </div>
      {mode === 'CLAIM' ? (
        <SearchList
          items={claimRows}
          isLoading={loadingClaims}
          query={query}
          onQueryChange={setQuery}
          placeholder={tr('ui.TargetPicker.numeroDeDossierOuAssureur')}
          keyOf={(c) => c.id}
          renderRow={(c) => (
            <Row
              title={c.number}
              subtitle={tr('ui.TargetPicker.vDemandeValueFcfa', { v: c.insurer?.name ?? '—', value: formatCurrency(Number(c.requestedAmount)) })}
              onClick={() =>
                onPick({
                  id: c.id,
                  reference: c.number,
                  branchId: null,
                  current: { requestedAmount: money(c.requestedAmount), acceptedAmount: money(c.acceptedAmount) },
                })
              }
            />
          )}
        />
      ) : (
        <SearchList
          items={refundRows}
          isLoading={loadingRefunds}
          query={query}
          onQueryChange={setQuery}
          placeholder={tr('ui.TargetPicker.numeroDeDossier')}
          keyOf={(r) => r.id}
          renderRow={(r) => (
            <Row
              title={tr('ui.TargetPicker.vValueFcfa', { v: r.claim?.number ?? '—', value: formatCurrency(Number(r.receivedAmount)) })}
              subtitle={new Date(r.receivedAt).toLocaleDateString(displayLocale())}
              onClick={() =>
                onPick({
                  id: r.id,
                  reference: r.claim?.number ?? '',
                  branchId: null,
                  current: { receivedAmount: money(r.receivedAmount) },
                })
              }
            />
          )}
        />
      )}
    </div>
  );
}
