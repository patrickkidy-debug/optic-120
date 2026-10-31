import { useState } from 'react';
import clsx from 'clsx';
import { Glasses, ShieldCheck } from 'lucide-react';
import { WARRANTY_PLAN, type WarrantyPlan } from '@oculo/shared-types';
import type { SaleDetail } from './api';
import { NumberInput } from '../../components/NumberInput';
import { formatCurrency, formatDate } from '../../lib/format';

// Avant-première : textes en français seulement (voir lib/beta.ts).

const pct = (rate: number) => `${Math.round(rate * 100)} %`;

/**
 * Formule de garantie choisie en caisse : verres 6 mois offerts ou 1 an
 * (+15 %), protection monture 6 mois (+10 %). Les montants affichés sont
 * ceux que le serveur ajoutera en lignes de facture.
 */
export function WarrantyPlanPicker({
  value,
  onChange,
  hasLens,
  hasFrame,
  lensFee,
  frameFee,
}: {
  value: WarrantyPlan;
  onChange: (plan: WarrantyPlan) => void;
  hasLens: boolean;
  hasFrame: boolean;
  lensFee: number;
  frameFee: number;
}) {
  const option = (active: boolean, disabled: boolean) =>
    clsx(
      'flex-1 rounded-lg border px-2.5 py-2 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-50',
      active ? 'border-primary bg-primary-soft/60 text-content' : 'bg-surface text-content-muted hover:border-primary/50',
    );
  return (
    <div className="rounded-xl border p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-content">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Garantie
      </p>

      <p className="mt-2 text-[11px] uppercase tracking-wide text-content-faint">Verres</p>
      <div className="mt-1 flex gap-2">
        <button type="button" disabled={!hasLens} className={option(value.lensMonths === 6, !hasLens)} onClick={() => onChange({ ...value, lensMonths: 6 })}>
          <b className="block text-content">6 mois</b>offerts
        </button>
        <button type="button" disabled={!hasLens} className={option(value.lensMonths === 12, !hasLens)} onClick={() => onChange({ ...value, lensMonths: 12 })}>
          <b className="block text-content">1 an</b>+{pct(WARRANTY_PLAN.lensExtendedRate)}
          {value.lensMonths === 12 && lensFee > 0 && ` · ${formatCurrency(lensFee)}`}
        </button>
      </div>

      <label className={clsx('mt-2 flex items-start gap-2 text-xs', hasFrame ? 'text-content' : 'text-content-faint')}>
        <input type="checkbox" className="mt-0.5" disabled={!hasFrame} checked={hasFrame && value.frame} onChange={(e) => onChange({ ...value, frame: e.target.checked })} />
        <span>
          <b>Protection monture 6 mois</b> · +{pct(WARRANTY_PLAN.frameRate)}
          {hasFrame && value.frame && frameFee > 0 && ` · ${formatCurrency(frameFee)}`}
          <span className="block text-[11px] text-content-faint">Dommage : le client paie {pct(WARRANTY_PLAN.frameClaimRate)} de la nouvelle monture.</span>
        </span>
      </label>
      <p className="mt-2 text-[11px] text-content-faint">
        Verres cassés ou perdus pendant la garantie : le client paie {pct(WARRANTY_PLAN.lensClaimRate)} du prix des verres.
      </p>
    </div>
  );
}

/** Garanties d'une vente et calcul de ce que le client paie en cas de sinistre. */
export function WarrantyPlanCard({ sale }: { sale: SaleDetail }) {
  const [framePrice, setFramePrice] = useState(0);
  if (!sale.lensWarrantyEndsAt && !sale.frameWarrantyEndsAt) return null;
  const now = Date.now();
  const lensTotal = sale.items.filter((i) => i.product.category === 'VERRE').reduce((s, i) => s + Number(i.lineTotal), 0);
  const status = (end: string) =>
    new Date(end).getTime() >= now ? (
      <span className="rounded-full bg-[color:var(--success)]/12 px-2 py-0.5 text-[11px] font-semibold text-success">Active</span>
    ) : (
      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-content-faint">Expirée</span>
    );

  return (
    <div className="space-y-3 rounded-xl border p-3 text-sm">
      <h4 className="flex items-center gap-1.5 font-semibold text-content">
        <ShieldCheck className="h-4 w-4 text-primary" /> Garantie
      </h4>
      {sale.lensWarrantyEndsAt && (
        <div className="rounded-lg bg-surface-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-medium text-content">
              <Glasses className="h-4 w-4" /> Verres jusqu'au {formatDate(sale.lensWarrantyEndsAt)}
            </span>
            {status(sale.lensWarrantyEndsAt)}
          </div>
          <p className="mt-1 text-xs text-content-muted">
            Casse ou perte : le client paie {pct(WARRANTY_PLAN.lensClaimRate)} des verres, soit{' '}
            <b className="text-content">{formatCurrency(Math.round(lensTotal * WARRANTY_PLAN.lensClaimRate))}</b>
            {' '}(verres : {formatCurrency(lensTotal)}).
          </p>
        </div>
      )}
      {sale.frameWarrantyEndsAt && (
        <div className="rounded-lg bg-surface-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-content">Monture jusqu'au {formatDate(sale.frameWarrantyEndsAt)}</span>
            {status(sale.frameWarrantyEndsAt)}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-content-muted">
            Prix de la nouvelle monture
            <NumberInput min={0} value={framePrice} onChange={setFramePrice} className="h-8 w-32 rounded-lg border bg-surface px-2 text-xs text-content" placeholder="0" />
            <span>
              Le client paie {pct(WARRANTY_PLAN.frameClaimRate)} :{' '}
              <b className="text-content">{formatCurrency(Math.round(framePrice * WARRANTY_PLAN.frameClaimRate))}</b>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Conditions imprimées sur la facture (texte brut : l'appelant l'échappe). */
export function warrantyPlanDocumentLines(sale: SaleDetail): string[] {
  const lines: string[] = [];
  if (sale.lensWarrantyEndsAt) {
    lines.push(
      `Verres garantis jusqu'au ${formatDate(sale.lensWarrantyEndsAt)} : en cas de casse ou de perte, le remplacement est facturé ${pct(WARRANTY_PLAN.lensClaimRate)} du prix des verres.`,
    );
  }
  if (sale.frameWarrantyEndsAt) {
    lines.push(
      `Monture protégée jusqu'au ${formatDate(sale.frameWarrantyEndsAt)} : en cas de dommage, le remplacement est facturé ${pct(WARRANTY_PLAN.frameClaimRate)} du prix de la nouvelle monture.`,
    );
  }
  return lines;
}
