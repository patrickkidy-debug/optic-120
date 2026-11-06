import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  Type, Sparkles, HardDrive, Wrench, Info, Keyboard, Users, ShieldHalf, Store, ScrollText, Crown, ListChecks,
  LifeBuoy, Wifi, WifiOff, ArrowRight, type LucideIcon,
} from 'lucide-react';
import { usePermission } from '../../store/auth';
import { currentOfflineDb } from '../../lib/offline/db';
import { counts } from '../../lib/offline/outbox';
import {
  getReduceMotion, getTextSize, repairApp, setReduceMotion, setTextSize, type TextSize,
} from '../../lib/displayPrefs';
import { Button } from '../../components/ui';

interface HubLink {
  to: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  perm?: string;
}

const HUB: HubLink[] = [
  { to: '/configuration-boutique', label: 'Configuration boutique', hint: 'Étapes guidées', icon: ListChecks, perm: 'dashboard.view' },
  { to: '/parametres/utilisateurs', label: 'Utilisateurs', hint: 'Comptes de l’équipe', icon: Users, perm: 'rbac.users.view' },
  { to: '/parametres/roles', label: 'Rôles et permissions', hint: 'Qui voit quoi', icon: ShieldHalf, perm: 'rbac.roles.view' },
  { to: '/parametres/magasins', label: 'Magasins', hint: 'Points de vente', icon: Store, perm: 'settings.branches.view' },
  { to: '/parametres/journal', label: 'Journal d’activité', hint: 'Qui a fait quoi', icon: ScrollText, perm: 'audit.logs.view' },
  { to: '/parametres/abonnement', label: 'Abonnement', hint: 'Offre, paiement, factures', icon: Crown, perm: 'billing.view' },
  { to: '/aide', label: 'Aide et support', hint: 'Questions, contact', icon: LifeBuoy },
];

function HubItem({ l }: { l: HubLink }) {
  const allowed = usePermission(l.perm ?? 'dashboard.view');
  if (l.perm && !allowed) return null;
  return (
    <Link to={l.to} className="flex items-center gap-3 rounded-xl border border-line p-3 transition hover:border-primary/50 hover:bg-primary/5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
        <l.icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-content">{l.label}</span>
        <span className="block text-xs text-content-muted">{l.hint}</span>
      </span>
      <ArrowRight className="h-4 w-4 text-content-faint" />
    </Link>
  );
}

/** Raccourcis vers tous les écrans de réglages auxquels l'utilisateur a accès. */
export function SettingsHub() {
  return (
    <div className="card mb-4 p-5">
      <h3 className="mb-3 font-display font-bold text-content">Tous les réglages</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {HUB.map((l) => (
          <HubItem key={l.to} l={l} />
        ))}
      </div>
    </div>
  );
}

function Choice<T extends string>({ value, current, label, onPick }: { value: T; current: T; label: string; onPick: (v: T) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(value)}
      className={clsx('card flex-1 p-3 text-center text-sm font-medium transition', current === value ? 'border-primary text-primary shadow-glow' : 'text-content hover:border-line-strong')}
    >
      {label}
    </button>
  );
}

/** Onglet « Préférences et appareil » : affichage, données locales, dépannage. */
export function DevicePreferences() {
  const [size, setSize] = useState<TextSize>(getTextSize());
  const [motion, setMotion] = useState(getReduceMotion());
  const [online, setOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState<{ pending: number; rejected: number } | null>(null);
  const [repairing, setRepairing] = useState(false);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const db = currentOfflineDb();
    if (db) void counts(db).then(setQueue).catch(() => setQueue(null));
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const build = Number(__SW_VERSION__);
  const buildLabel = Number.isFinite(build)
    ? new Date(build).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  async function repair() {
    if (queue && queue.pending > 0) {
      const ok = window.confirm(
        `${queue.pending} opération(s) attendent encore d’être envoyées. Elles seront conservées, mais il vaut mieux attendre la synchronisation. Réparer quand même ?`,
      );
      if (!ok) return;
    }
    setRepairing(true);
    await repairApp();
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Taille du texte */}
      <div className="card p-5">
        <div className="mb-1 flex items-center gap-2">
          <Type className="h-5 w-5 text-primary" />
          <h3 className="font-display font-bold text-content">Taille du texte</h3>
        </div>
        <p className="mb-4 text-sm text-content-muted">Agrandit tout l’écran sur cet appareil, pratique sur un petit écran ou pour mieux lire.</p>
        <div className="flex gap-2">
          {([['normal', 'Normale'], ['large', 'Grande'], ['xlarge', 'Très grande']] as const).map(([v, l]) => (
            <Choice key={v} value={v} current={size} label={l} onPick={(x) => { setSize(x); setTextSize(x); }} />
          ))}
        </div>
      </div>

      {/* Animations */}
      <div className="card p-5">
        <div className="mb-1 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-display font-bold text-content">Animations</h3>
        </div>
        <p className="mb-4 text-sm text-content-muted">Réduire les animations rend l’application plus rapide sur un ordinateur ou un téléphone ancien.</p>
        <label className="flex cursor-pointer items-center gap-3 text-sm text-content">
          <input type="checkbox" checked={motion} onChange={(e) => { setMotion(e.target.checked); setReduceMotion(e.target.checked); }} />
          Réduire les animations
        </label>
      </div>

      {/* Données de l'appareil */}
      <div className="card p-5">
        <div className="mb-1 flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-primary" />
          <h3 className="font-display font-bold text-content">Données sur cet appareil</h3>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
            <span className="text-content-muted">Connexion</span>
            <span className={clsx('flex items-center gap-1.5 font-semibold', online ? 'text-success' : 'text-danger')}>
              {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />} {online ? 'En ligne' : 'Hors ligne'}
            </span>
          </li>
          <li className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
            <span className="text-content-muted">Opérations en attente d’envoi</span>
            <span className={clsx('font-semibold', queue?.pending ? 'text-warning' : 'text-content')}>{queue ? queue.pending : '—'}</span>
          </li>
          <li className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
            <span className="text-content-muted">Opérations refusées par le serveur</span>
            <span className={clsx('font-semibold', queue?.rejected ? 'text-danger' : 'text-content')}>{queue ? queue.rejected : '—'}</span>
          </li>
        </ul>
        <p className="mt-3 text-xs text-content-faint">
          Les ventes faites sans internet sont gardées ici puis envoyées automatiquement. Ne videz pas les données du navigateur tant qu’il reste des opérations en attente.
        </p>
      </div>

      {/* Dépannage */}
      <div className="card p-5">
        <div className="mb-1 flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          <h3 className="font-display font-bold text-content">Réparer l’application</h3>
        </div>
        <p className="mb-4 text-sm text-content-muted">
          Une page ne s’affiche plus, ou une nouveauté n’apparaît pas ? Ceci vide le cache et recharge la dernière version. Vos données et vos opérations en attente sont conservées.
        </p>
        <Button variant="outline" onClick={() => void repair()} loading={repairing}>
          <Wrench className="h-4 w-4" /> Réparer et recharger
        </Button>
        <div className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
          <p className="flex items-center gap-2 text-content-muted">
            <Info className="h-4 w-4 shrink-0" /> Version installée : <span className="font-semibold text-content">{buildLabel}</span>
          </p>
          <p className="flex items-center gap-2 text-content-muted">
            <Keyboard className="h-4 w-4 shrink-0" /> Recherche rapide : <kbd className="rounded border border-line bg-surface-2 px-1.5 text-xs">Ctrl</kbd> +{' '}
            <kbd className="rounded border border-line bg-surface-2 px-1.5 text-xs">K</kbd>
          </p>
        </div>
      </div>
    </div>
  );
}
