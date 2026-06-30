/** Contexte d'authentification résolu et attaché à chaque requête protégée. */
export interface AuthContext {
  userId: string;
  tenantId: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  email: string;
  firstName: string;
  lastName: string;
  permissions: Set<string>;
  branchIds: string[];
  allBranches: boolean;
  subscriptionStatus?: string;
  /** Code de l'offre (TRIAL/STANDARD/PREMIUM) — sert au verrouillage de fonctionnalités premium. */
  planCode?: string;
}
