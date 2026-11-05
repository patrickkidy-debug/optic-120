import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import JsBarcode from 'jsbarcode';
import { Printer, Barcode as BarcodeIcon } from 'lucide-react';
import { listProducts, type Product } from '../../features/optique/api';
import { PageHeader, Button, Field, PageLoader, EmptyState } from '../../components/ui';
import { formatCurrency } from '../../lib/format';
import { tr } from '../../lib/tr';

interface LabelData {
  name: string;
  code: string;
  price: number;
}

/**
 * Étiquette de branche de monture : 38 × 12 mm, à enrouler / coller sur la
 * branche. Nom court, code-barres fin, prix. Les verres n'ont pas d'étiquette
 * (fabriqués sur commande, jamais en rayon).
 */
const LABEL_W = '38mm';
const LABEL_H = '12mm';

function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        width: 0.8,
        height: 16,
        displayValue: false,
        margin: 0,
        background: '#ffffff',
        lineColor: '#000000',
      });
    } catch {
      /* SKU non encodable : ignoré */
    }
  }, [value]);
  return <svg ref={ref} preserveAspectRatio="none" style={{ width: '100%', height: '4.2mm', display: 'block' }} />;
}

function LabelCard({ name, code, price, onPrint }: LabelData & { onPrint?: () => void }) {
  return (
    <div
      className="group relative flex flex-col justify-between overflow-hidden border border-dashed border-black/30 bg-white px-[1mm] py-[0.6mm] text-black"
      style={{ width: LABEL_W, height: LABEL_H, breakInside: 'avoid' }}
    >
      {onPrint && (
        <button
          onClick={onPrint}
          title={tr('ui.LabelsPage.imprimerCetteEtiquetteSeule')}
          className="print-hide absolute right-0.5 top-0.5 rounded bg-black/5 p-0.5 text-black/50 opacity-0 transition hover:bg-black/10 hover:text-black group-hover:opacity-100"
        >
          <Printer className="h-3 w-3" />
        </button>
      )}
      <div className="flex items-baseline justify-between gap-[1mm] leading-none">
        <span className="truncate font-semibold" style={{ fontSize: '6.5pt' }}>{name}</span>
        <span className="shrink-0 font-bold" style={{ fontSize: '7pt' }}>{formatCurrency(price)}</span>
      </div>
      <Barcode value={code} />
      <div className="truncate text-center font-mono leading-none" style={{ fontSize: '5.5pt' }}>{code}</div>
    </div>
  );
}

export function LabelsPage() {
  const [search, setSearch] = useState('');
  // Étiquette à imprimer seule (null = impression de toute la planche).
  const [printOne, setPrintOne] = useState<LabelData | null>(null);

  // Étiquettes réservées aux montures : ce sont les seuls articles exposés en rayon.
  const { data, isLoading } = useQuery({
    queryKey: ['products-labels', 'MONTURE', search],
    queryFn: () => listProducts({ category: 'MONTURE', search: search || undefined, pageSize: 100 }),
  });
  const montures: Product[] = (data?.items ?? []).filter((p) => p.isActive !== false);

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
          title={tr('ui.LabelsPage.etiquettesCodesBarres')}
          subtitle="Étiquettes de branche (38 × 12 mm) pour les montures en rayon."
          actions={
            <Button onClick={() => window.print()} disabled={!montures.length}>
              <Printer className="h-4 w-4" /> {tr('ui.LabelsPage.toutImprimer')}
            </Button>
          }
        />
        <div className="mb-4 max-w-sm">
          <Field label={tr('ui.LabelsPage.rechercherUneMonture')}>
            <input className="input" placeholder={tr('ui.LabelsPage.nomReferenceMarque')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </Field>
        </div>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : !montures.length ? (
        <EmptyState icon={BarcodeIcon} title={tr('ui.LabelsPage.aucuneMontureAuCatalogue')} />
      ) : (
        <div className={printOne ? '' : 'print-area'}>
          <p className="print-hide mb-2 text-xs text-content-muted">{montures.length} monture(s) · taille réelle à l'impression.</p>
          <div className="flex flex-wrap gap-[1.5mm] rounded-xl bg-white p-[2mm]">
            {montures.map((p) => {
              // Marque devant le modèle, sauf si le nom la contient déjà.
              const withBrand = p.brand && !p.name.toLowerCase().includes(p.brand.toLowerCase());
              const label: LabelData = { name: withBrand ? `${p.brand} ${p.name}` : p.name, code: p.sku, price: Number(p.sellPrice) };
              return <LabelCard key={p.id} {...label} onPrint={() => setPrintOne(label)} />;
            })}
          </div>
        </div>
      )}

      {printOne && (
        <div className="print-area fixed left-0 top-0">
          <LabelCard {...printOne} />
        </div>
      )}
    </div>
  );
}
