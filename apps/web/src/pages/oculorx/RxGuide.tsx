import { useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, Compass } from 'lucide-react';
import { RX_FABRICATION_LABELS, RX_INDEX_GUIDE, RX_STOCK_LIMITS, type RxFabrication } from '@oculo/shared-types';
import { th, td } from './ui';

/** Badge « Stock » / « RX » d'un verre. */
export function FabricationBadge({ value }: { value?: string | null }) {
  if (!value) return null;
  return (
    <span className={clsx('badge whitespace-nowrap', value === 'RX' ? 'bg-accent-soft text-accent' : 'bg-[color:var(--success)]/15 text-success')}>
      {RX_FABRICATION_LABELS[value as RxFabrication] ?? value}
    </span>
  );
}

/**
 * Grille de conseil affichée dans OculoRX : quand vendre du stock ou du RX,
 * et quel indice (1.56, 1.60, 1.67) selon la puissance de l'ordonnance.
 */
export function RxGuide({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="card p-0">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 p-4 text-left">
        <Compass className="h-5 w-5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-content">Guide de vente : stock ou RX, quel indice ?</span>
          <span className="block text-xs text-content-muted">Grille des valeurs selon l'ordonnance du patient.</span>
        </span>
        <ChevronDown className={clsx('h-5 w-5 text-content-faint transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-4 border-t p-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-content-faint">1 · Quel indice vendre ?</p>
            <p className="mb-2 text-xs text-content-muted">
              On regarde la <b>puissance la plus forte</b> de l'ordonnance (l'œil le plus fort, sphère et sphère + cylindre).
              Exemple : OD -3,50 (-1,00) → puissance 4,50 D.
            </p>
            <table className="w-full overflow-hidden rounded-xl border text-sm">
              <thead><tr className="border-b bg-surface-2/60"><th className={th}>Puissance</th><th className={th}>Indice à vendre</th></tr></thead>
              <tbody>
                {RX_INDEX_GUIDE.map((g) => (
                  <tr key={g.label} className="border-b last:border-0">
                    <td className={`${td} whitespace-nowrap font-mono text-xs`}>{g.label}</td>
                    <td className={td}><b className="font-mono">{g.index.toFixed(2).replace('.', ',')}</b> <span className="text-xs text-content-muted">— {g.advice.split('— ')[1] ?? g.advice}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-content-faint">Plus l'indice est élevé, plus le verre est fin. LUNEO s'arrête à 1.67 (amincissement : +19 000 F la paire).</p>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-content-faint">2 · Stock ou RX ?</p>
            <table className="w-full overflow-hidden rounded-xl border text-sm">
              <thead><tr className="border-b bg-surface-2/60"><th className={th}>Situation</th><th className={th}>Verre</th></tr></thead>
              <tbody>
                <tr className="border-b">
                  <td className={`${td} text-xs`}>Unifocal, sphère entre -{RX_STOCK_LIMITS.sph},00 et +{RX_STOCK_LIMITS.sph},00, cylindre jusqu'à {RX_STOCK_LIMITS.cyl},00, indice 1.56</td>
                  <td className={td}><FabricationBadge value="STOCK" /> <span className="block text-[11px] text-content-faint">prêt, livré vite, moins cher</span></td>
                </tr>
                <tr className="border-b">
                  <td className={`${td} text-xs`}>Tout progressif (vision de loin + près)</td>
                  <td className={td}><FabricationBadge value="RX" /></td>
                </tr>
                <tr className="border-b">
                  <td className={`${td} text-xs`}>Sphère au-delà de ±{RX_STOCK_LIMITS.sph},00 ou cylindre au-delà de {RX_STOCK_LIMITS.cyl},00</td>
                  <td className={td}><FabricationBadge value="RX" /></td>
                </tr>
                <tr>
                  <td className={`${td} text-xs`}>Indice 1.60 ou 1.67 (amincissement), prisme, montage particulier</td>
                  <td className={td}><FabricationBadge value="RX" /> <span className="block text-[11px] text-content-faint">fabriqué sur mesure (surfacé)</span></td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-content-faint">Valeurs d'usage en magasin : confirmez les limites exactes du stock avec votre fournisseur.</p>
          </div>
        </div>
      )}
    </section>
  );
}
