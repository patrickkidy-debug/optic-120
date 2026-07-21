import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import JsBarcode from 'jsbarcode';
import { Printer, Barcode as BarcodeIcon } from 'lucide-react';
import { LENS_BASES, lensLabel, lensSku, DEFAULT_LENS_PRICING } from '@oculo/shared-types';
import { listProducts, type Product } from '../../features/optique/api';
import { useAuthStore } from '../../store/auth';
import { PageHeader, Button, Field, PageLoader, EmptyState } from '../../components/ui';

function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        width: 1.6,
        height: 44,
        fontSize: 13,
        margin: 4,
        background: '#ffffff',
        lineColor: '#000000',
      });
    } catch {
      /* SKU non encodable : ignoré */
    }
  }, [value]);
  return <svg ref={ref} className="max-w-full" />;
}

const money = (n: number) => `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} FCFA`;

function LabelCard({ name, code, price }: { name: string; code: string; price: number }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-line bg-white p-3 text-center text-black">
      <div className="line-clamp-2 text-xs font-semibold">{name}</div>
      <Barcode value={code} />
      <div className="text-sm font-bold">{money(price)}</div>
    </div>
  );
}

export function LabelsPage() {
  const [search, setSearch] = useState('');
  // Étiquettes réservées aux montures (produits physiques) et aux types de verres.
  const { data, isLoading } = useQuery({
    queryKey: ['products-labels', 'MONTURE', search],
    queryFn: () => listProducts({ category: 'MONTURE', search: search || undefined }),
  });
  const montures: Product[] = data?.items ?? [];

  const pricing = useAuthStore((s) => s.user?.tenantLensPricing) ?? DEFAULT_LENS_PRICING;
  // Un seul étiquetage par type de verre (barème des Réglages), pas par produit.
  const lensTypes = LENS_BASES.map((b) => ({
    name: lensLabel(b.key, []),
    code: lensSku(b.key, []),
    price: pricing[b.key],
  }));

  const nothing = montures.length === 0 && lensTypes.length === 0;

  return (
    <div>
      <div className="print-hide">
        <PageHeader
          title="Étiquettes & codes-barres"
          subtitle="Étiquettes des montures et des types de verres"
          actions={
            <Button onClick={() => window.print()} disabled={nothing}>
              <Printer className="h-4 w-4" /> Imprimer
            </Button>
          }
        />
        <div className="mb-4 max-w-sm">
          <Field label="Rechercher une monture">
            <input
              className="input"
              placeholder="Nom, référence, marque…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
        </div>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : nothing ? (
        <EmptyState icon={BarcodeIcon} title="Aucune étiquette à générer" />
      ) : (
        <div className="print-area space-y-6">
          <section>
            <h2 className="print-hide mb-2 text-sm font-semibold uppercase tracking-wide text-content-faint">
              Montures
            </h2>
            {montures.length === 0 ? (
              <p className="print-hide text-sm text-content-muted">Aucune monture au catalogue.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {montures.map((p) => (
                  <LabelCard key={p.id} name={p.name} code={p.sku} price={Number(p.sellPrice)} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="print-hide mb-2 text-sm font-semibold uppercase tracking-wide text-content-faint">
              Types de verres
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {lensTypes.map((l) => (
                <LabelCard key={l.code} name={l.name} code={l.code} price={l.price} />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
