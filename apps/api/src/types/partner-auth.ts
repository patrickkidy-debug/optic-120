import type { PartnerStatus, PartnerTierCode } from '@oculo/shared-types';

/** Contexte d'authentification partenaire, attaché après requirePartnerAuth. */
export interface PartnerAuthContext {
  partnerId: string;
  status: PartnerStatus;
  tier: PartnerTierCode;
}
