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
}
