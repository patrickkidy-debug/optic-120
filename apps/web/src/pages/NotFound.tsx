import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export function NotFound() {
  return (
    <div className="grid place-items-center py-24 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary-soft text-primary">
        <Compass className="h-7 w-7" />
      </div>
      <h1 className="mt-5 font-display text-3xl font-bold text-content">404</h1>
      <p className="mt-2 text-content-muted">Cette page n'existe pas.</p>
      <Link to="/dashboard" className="btn-primary mt-5">
        Retour au tableau de bord
      </Link>
    </div>
  );
}
