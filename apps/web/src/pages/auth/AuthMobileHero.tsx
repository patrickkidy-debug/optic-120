import { CheckCircle2, Eye, PackageCheck, ScanFace } from 'lucide-react';
import { tr } from '../../lib/tr';
import { FluidScene } from '../../components/FluidScene';

/**
 * Bandeau mobile des écrans d'authentification (connexion, inscription…).
 *
 * Décor « fluide technologique » de la marque (violet profond, formes liquides
 * violet → rose → orange, réseau lumineux), photo d'un client avec sa monture (personne
 * fictive) et cartes d'interface flottantes qui évoquent l'application :
 * paiement Mobile Money, mesure de centrage, commande prête. Les cartes sont
 * décoratives (aria-hidden) : le contenu utile reste le titre.
 */
export function AuthMobileHero({
  variant = 'login',
  panel = false,
  children,
}: {
  variant?: 'login' | 'signup';
  /** Panneau gauche des grands écrans (tablette paysage, ordinateur) : pleine hauteur. */
  panel?: boolean;
  children?: React.ReactNode;
}) {
  const photo = variant === 'signup' ? '/images/auth/opticienne.webp' : '/images/auth/client-lunettes.webp';
  return (
    <div
      className={
        panel
          ? 'relative flex h-full flex-col justify-between overflow-hidden p-10 xl:p-12'
          : 'relative overflow-hidden px-5 pb-14 md:px-10 md:pb-20'
      }
      style={panel ? undefined : { paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}
    >
      <FluidScene layout="spread" />

      <div className={panel ? 'relative flex flex-1 flex-col' : 'relative'}>
        {/* Marque */}
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand shadow-[0_8px_20px_rgba(124,58,237,0.35)]">
            <Eye className="h-5 w-5 text-white" strokeWidth={2.6} />
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight text-white">
            Oculo<span className="bg-gradient-to-r from-pink-300 via-fuchsia-300 to-orange-300 bg-clip-text text-transparent">SaaS</span>
          </span>
        </div>

        {/* Composition : photo + cartes flottantes */}
        <div
          className={`relative mx-auto mt-5 h-[248px] w-full max-w-[340px] md:h-[360px] md:max-w-[480px] ${panel ? 'my-auto lg:h-[400px] xl:h-[440px] xl:max-w-[520px]' : ''}`}
          aria-hidden="true"
        >
          <div className="absolute left-1/2 top-2 h-[220px] w-[200px] -translate-x-1/2 md:h-[320px] md:w-[290px] xl:h-[380px] xl:w-[340px] rotate-[-3deg] overflow-hidden rounded-[28px] border border-white/40 shadow-[0_30px_70px_rgba(20,0,60,0.55)] ring-4 ring-white/15">
            <img src={photo} alt="" className="h-full w-full object-cover" loading="eager" decoding="async" />
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent" />
          </div>

          <div className="absolute left-0 top-6 flex animate-float md:top-10 md:scale-110 md:origin-left items-center gap-2 rounded-2xl border border-white/70 bg-white/85 px-3 py-2 shadow-card-lg backdrop-blur-md dark:border-white/10 dark:bg-slate-900/80">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[color:var(--success)]/15 text-success"><CheckCircle2 className="h-4 w-4" /></span>
            <span className="text-left">
              <span className="block text-[10px] font-medium text-content-muted">{tr('auth.heroPayLabel')}</span>
              <span className="block text-xs font-bold text-content">{tr('auth.heroPayValue')}</span>
            </span>
          </div>

          <div className="absolute right-0 top-[92px] flex animate-float-slow md:top-[150px] md:scale-110 md:origin-right items-center gap-2 rounded-2xl border border-white/70 bg-white/85 px-3 py-2 shadow-card-lg backdrop-blur-md dark:border-white/10 dark:bg-slate-900/80" style={{ animationDelay: '1.2s' }}>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary-soft text-primary"><ScanFace className="h-4 w-4" /></span>
            <span className="text-left">
              <span className="block text-[10px] font-medium text-content-muted">{tr('auth.heroMeasureLabel')}</span>
              <span className="block text-xs font-bold text-content">{tr('auth.heroMeasureValue')}</span>
            </span>
          </div>

          <div className="absolute bottom-0 left-4 flex animate-float md:left-10 md:scale-110 md:origin-left items-center gap-2 rounded-2xl bg-brand px-3 py-2 text-white shadow-[0_14px_30px_rgba(236,72,153,0.35)]" style={{ animationDelay: '0.6s' }}>
            <PackageCheck className="h-4 w-4" />
            <span className="text-xs font-bold">{tr('auth.heroOrder')}</span>
          </div>
        </div>

        {/* Accroche */}
        <h1 className={`mt-5 text-center font-display text-[26px] font-extrabold leading-tight tracking-tight text-white drop-shadow-[0_4px_18px_rgba(30,0,70,0.5)] md:text-4xl ${panel ? 'xl:text-[42px]' : ''}`}>
          {tr('auth.heroTitleA')}{' '}
          <span className="bg-gradient-to-r from-pink-300 via-fuchsia-200 to-orange-300 bg-clip-text text-transparent">{tr('auth.heroTitleB')}</span>
        </h1>
        {children}
      </div>
    </div>
  );
}
