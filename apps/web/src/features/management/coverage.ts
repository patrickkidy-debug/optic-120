import { useQuery } from '@tanstack/react-query';
import { computeGuaranteeCoverage, type CoverageCartLine } from '@oculo/shared-types';
import { getCustomerCoverage, type CustomerCoverage, type Insurer } from './api';

/**
 * Contrat applicable au client sélectionné. Sans client, sans assureur ou sans
 * contrat actif, la requête n'est pas lancée : la caisse retombe alors sur le
 * taux de l'assureur.
 */
export function useCustomerCoverage(customerId: string | null, insurerId: string, enabled = true) {
  return useQuery({
    queryKey: ['insurance-coverage', customerId, insurerId],
    queryFn: () => getCustomerCoverage(customerId!, insurerId || undefined),
    enabled: enabled && Boolean(customerId) && Boolean(insurerId),
  });
}

export interface CoverageDecision {
  amount: number;
  /** Phrase courte expliquant d'où vient le montant, affichée au vendeur. */
  rule: string;
}

/**
 * Part assurance d'un panier.
 *
 * Les garanties portent sur les produits : elles s'appliquent aux lignes du
 * panier, catégorie par catégorie, puis le résultat est plafonné au total à
 * payer. Sans contrat applicable, on garde le comportement historique — le
 * taux de l'assureur sur le total.
 */
export function decideCoverage(
  lines: CoverageCartLine[],
  total: number,
  insurer: Insurer | undefined,
  coverage: CustomerCoverage | undefined,
): CoverageDecision {
  if (coverage?.matched && coverage.guarantees && coverage.guarantees.length > 0) {
    const result = computeGuaranteeCoverage(lines, coverage.guarantees);
    if (result.matched) {
      const detail = result.lines
        .filter((l) => l.covered > 0)
        .map((l) => `${l.coveragePercent} %${l.capped ? ' (plafond)' : ''}`)
        .join(' · ');
      return {
        amount: Math.min(result.amount, total),
        rule: `Garanties du contrat ${coverage.contract?.name ?? ''}${detail ? ` — ${detail}` : ''}`.trim(),
      };
    }
  }
  if (!insurer) return { amount: 0, rule: '' };
  return {
    amount: Math.round((total * insurer.coveragePercent) / 100),
    rule: `Taux par défaut de ${insurer.name} — ${insurer.coveragePercent} %`,
  };
}
