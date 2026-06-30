import { useQuery } from '@tanstack/react-query';
import { planHasFeature, type PremiumFeature } from '@oculo/shared-types';
import { getPlanStatus } from './api';

/**
 * Statut d'offre accessible à TOUT utilisateur connecté (pas seulement les
 * gérants avec billing.view) : un opticien ou un secrétaire doit voir les
 * mêmes verrous de fonctionnalités premium que l'administrateur.
 */
export function useSubscriptionPlan() {
  const { data: status } = useQuery({ queryKey: ['plan-status'], queryFn: getPlanStatus });
  const planCode = status?.planCode ?? 'TRIAL';
  return {
    status,
    planCode,
    isTrial: planCode === 'TRIAL',
    hasFeature: (feature: PremiumFeature) => planHasFeature(planCode, feature),
  };
}
