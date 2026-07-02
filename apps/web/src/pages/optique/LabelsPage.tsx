import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import JsBarcode from 'jsbarcode';
import { Printer, Barcode as BarcodeIcon } from 'lucide-react';
import { listProducts, type Product } from '../../features/optique/api';
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

export function LabelsPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['products-labels', search],
    queryFn: () => listProducts({ search: search || undefined }),
  });
  const products: Product[] = data?.items ?? [];

  return (
    <div>
      <div className="print-hide">
        <PageHeader
          title="Étiquettes & codes-barres"
          subtitle="Générez et imprimez des étiquettes code-barres pour vos produits"
          actions={
            <Button onClick={() => window.print()} disabled={products.length === 0}>
              <Printer className="h-4 w-4" /> Imprimer
            </Button>
          }
        />
        <div className="mb-4 max-w-sm">
          <Field label="Rechercher un produit">
            <input
              className="input"
              placeholder="Nom, SKU, marque…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
        </div>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : products.length === 0 ? (
        <EmptyState icon={BarcodeIcon} title="Aucun produit à étiqueter" />
      ) : (
        <div className="print-area grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <div
              key={p.id}
              className="flex flex-col items-center gap-1 rounded-lg border border-line bg-white p-3 text-center text-black"
            >
              <div className="line-clamp-2 text-xs font-semibold">{p.name}</div>
              <Barcode value={p.sku} />
              <div className="text-sm font-bold">
                {new Intl.NumberFormat('fr-FR').format(Number(p.sellPrice))} FCFA
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
