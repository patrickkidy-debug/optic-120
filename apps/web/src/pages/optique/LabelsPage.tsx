import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import JsBarcode from 'jsbarcode';
import { Printer, Barcode as BarcodeIcon } from 'lucide-react';
import { lensBaseOptions, lensLabel, lensSku, DEFAULT_LENS_PRICING } from '@oculo/shared-types';
import { listProducts, type Product } from '../../features/optique/api';
import { useAuthStore } from '../../store/auth';
import { PageHeader, Button, Field, PageLoader, EmptyState } from '../../components/ui';

interface LabelData {
  name: string;
  code: string;
  price: number;
}

function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      // Format compact : facile à coller sur une monture / un étui de verres.
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        width: 1.1,
        height: 26,
        fontSize: 9,
        margin: 2,
        background: '#ffffff',
        lineColor: '#000000',
      });
    } catch {
      /* SKU non encodable : ignoré */
    }
  }, [value]);
  return <svg ref={ref} className="w-full max-w-full" />;
}

const money = (n: number) => `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} FCFA`;

function LabelCard({ name, code, price, onPrint }: LabelData & { onPrint?: () => void }) {
  return (
    <div className="group relative flex flex-col items-center gap-0.5 rounded-md border border-line bg-white p-2 text-center text-black">
      {onPrint && (
        <button
          onClick={onPrint}
          title="Imprimer cette étiquette seule"
          className="print-hide absolute right-1 top-1 rounded-md bg-black/5 p-1 text-black/50 opacity-0 transition hover:bg-black/10 hover:text-black group-hover:opacity-100"
        >
          <Printer className="h-3.5 w-3.5" />
        </button>
      )}
      <div className="line-clamp-2 text-[10px] font-semibold leading-tight">{name}</div>
      <Barcode value={code} />
      <div className="text-xs font-bold leading-none">{money(price)}</div>
    </div>
  );
}

export function LabelsPage() {
  const [search, setSearch] = useState('');
  // Étiquette à imprimer seule (null = impression de toute la planche).
  const [printOne, setPrintOne] = useState<LabelData | null>(null);

  // Étiquettes réservées aux montures (produits physiques) et aux types de verres.
  const { data, isLoading } = useQuery({
    queryKey: ['products-labels', 'MONTURE', search],
    queryFn: () => listProducts({ category: 'MONTURE', search: search || undefined }),
  });
  const montures: Product[] = data?.items ?? [];

  const pricing = useAuthStore((s) => s.user?.tenantLensPricing) ?? DEFAULT_LENS_PRICING;
  // Un seul étiquetage par type de verre (fixes + personnalisés), pas par produit.
  const lensTypes: LabelData[] = lensBaseOptions(pricing).map((b) => ({
    name: lensLabel(pricing, b.key, []),
    code: lensSku(b.key, []),
    price: b.price,
  }));

  const nothing = montures.length === 0 && lensTypes.length === 0;

  // Impression d'une seule étiquette : on la rend dans une zone dédiée puis on
  // déclenche l'impression ; l'écouteur `afterprint` remet l'état à zéro.
  useEffect(() => {
    if (!printOne) return;
    const done = () => setPrintOne(null);
    window.addEventListener('afterprint', done, { once: true });
    const id = window.setTimeout(() => window.print(), 80);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('afterprint', done);
    };
  }, [printOne]);

  return (
    <div>
      <div className="print-hide">
        <PageHeader
          title="Étiquettes & codes-barres"
          subtitle="Montures et types de verres — survolez une étiquette pour l'imprimer seule"
          actions={
            <Button onClick={() => window.print()} disabled={nothing}>
              <Printer className="h-4 w-4" /> Tout imprimer
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
        // Quand on imprime une seule étiquette, la planche complète n'est plus
        // « print-area » (donc non imprimée) : seule l'étiquette choisie sort.
        <div className={printOne ? 'space-y-6' : 'print-area space-y-6'}>
          <section>
            <h2 className="print-hide mb-2 text-sm font-semibold uppercase tracking-wide text-content-faint">
              Montures
            </h2>
            {montures.length === 0 ? (
              <p className="print-hide text-sm text-content-muted">Aucune monture au catalogue.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {montures.map((p) => {
                  const label: LabelData = { name: p.name, code: p.sku, price: Number(p.sellPrice) };
                  return <LabelCard key={p.id} {...label} onPrint={() => setPrintOne(label)} />;
                })}
              </div>
            )}
          </section>

          <section>
            <h2 className="print-hide mb-2 text-sm font-semibold uppercase tracking-wide text-content-faint">
              Types de verres
            </h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {lensTypes.map((l) => (
                <LabelCard key={l.code} {...l} onPrint={() => setPrintOne(l)} />
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Zone d'impression d'une seule étiquette (largeur d'une vignette). */}
      {printOne && (
        <div className="print-area fixed left-2 top-2">
          <div className="w-40">
            <LabelCard {...printOne} />
          </div>
        </div>
      )}
    </div>
  );
}
