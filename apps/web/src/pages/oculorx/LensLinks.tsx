import { Link } from 'react-router-dom';
import { Glasses, PackageSearch } from 'lucide-react';
import type { RxLensLink } from '../../features/oculorx/api';

/** Raccourcis vers la commande de verres liée (Kanban) et son suivi OculoTrack. */
export function LensLinks({ link }: { link: RxLensLink | null }) {
  if (!link) return <p className="text-xs text-content-faint">Aucune commande de verres liée.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      <Link to="/optique/commandes-verres" className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold text-content transition hover:border-primary">
        <Glasses className="h-4 w-4 text-primary" /> Commande de verres <span className="font-mono">{link.number}</span>
      </Link>
      {link.trackCode && (
        <Link to={`/optique/oculotrack?order=${link.id}`} className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold text-content transition hover:border-primary">
          <PackageSearch className="h-4 w-4 text-primary" /> OculoTrack <span className="font-mono">{link.trackCode}</span>
        </Link>
      )}
    </div>
  );
}
