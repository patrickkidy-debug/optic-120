import { useEffect, useRef } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { useUIStore } from '../../store/ui';
import { useAuthStore } from '../../store/auth';
import { usePosStore } from '../../store/pos';
import { tr } from '../../lib/tr';

/**
 * Contexte « magasin actif ».
 *
 * Tout changement de magasin passe par `switchBranch` : il demande
 * confirmation si une saisie liée au magasin courant n'est pas enregistrée
 * (devis en cours, panier de caisse, réception de stock…), puis mémorise le
 * choix pour l'utilisateur connecté. Les requêtes étant indexées par magasin,
 * les écrans rechargent les données du nouveau magasin sans jamais réafficher
 * celles du précédent.
 */

type Guard = () => string | null;
const guards = new Set<{ current: Guard }>();

/**
 * Déclare une saisie non enregistrée liée au magasin actif. Tant que `dirty`
 * est vrai, un changement de magasin demande confirmation avec `message`.
 */
export function useBranchSwitchGuard(dirty: boolean, message?: string) {
  const ref = useRef<Guard>(() => null);
  ref.current = () => (dirty ? message ?? tr('br.switch.unsaved') : null);
  useEffect(() => {
    const entry = ref;
    guards.add(entry);
    return () => {
      guards.delete(entry);
    };
  }, []);
}

const userKey = (userId: string) => `oculo_branch:${userId}`;

/** Magasin mémorisé pour cet utilisateur (sur cet appareil). */
export function rememberedBranch(userId: string | undefined): string | null {
  if (!userId) return null;
  try {
    return localStorage.getItem(userKey(userId));
  } catch {
    return null;
  }
}

function remember(id: string) {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return;
  try {
    localStorage.setItem(userKey(userId), id);
  } catch {
    /* stockage indisponible : le choix vaut pour la session */
  }
}

/**
 * Change le magasin actif. Renvoie false si l'utilisateur annule.
 * `silent` : correction automatique (magasin invalide), sans confirmation.
 */
export function switchBranch(id: string, qc?: QueryClient, opts: { silent?: boolean } = {}): boolean {
  const ui = useUIStore.getState();
  if (ui.activeBranchId === id) return true;
  if (!opts.silent) {
    const pending = [...guards].map((g) => g.current()).filter(Boolean) as string[];
    if (pending.length && !confirm(`${[...new Set(pending)].join('\n')}\n\n${tr('br.switch.confirm')}`)) return false;
    const pos = usePosStore.getState();
    if (pos.lines.length) {
      if (!confirm(tr('br.switch.cart'))) return false;
      pos.clear();
    }
  }
  ui.setActiveBranch(id);
  remember(id);
  // Les listes « tous magasins » de la page Magasins dépendent aussi du contexte affiché.
  qc?.invalidateQueries({ queryKey: ['branch-overview'] });
  return true;
}
