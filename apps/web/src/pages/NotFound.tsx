import { Link } from 'react-router-dom';
import { Mascot } from '../components/brand/Mascot';
import { tr } from '../lib/tr';

export function NotFound() {
  return (
    <div className="grid place-items-center py-24 text-center">
      <Mascot className="w-[140px]" />
      <h1 className="mt-4 font-arcade text-5xl text-gradient">404</h1>
      <p className="mt-2 text-content-muted">{tr('ui.NotFound.cettePageNExistePas')}</p>
      <Link to="/dashboard" className="btn-primary mt-5">
        {tr('ui.NotFound.retourAuTableauDeBord')}
      </Link>
    </div>
  );
}
