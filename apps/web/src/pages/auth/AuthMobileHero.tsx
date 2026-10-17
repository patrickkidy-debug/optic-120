import { CheckCircle2, Eye, PackageCheck, ScanFace } from 'lucide-react';
import { tr } from '../../lib/tr';

/**
 * Bandeau mobile des écrans d'authentification (connexion, inscription…).
 *
 * Fond clair aux couleurs de la marque (dégradé violet → rose → orange très
 * doux, sombre en thème sombre), photo d'un client avec sa monture (personne
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
      {/* Fond : dégradé maillé de la marque */}
      <div className="absolute inset-0 bg-[linear-gradient(160deg,#f5f3ff_0%,#fdf2f8_45%,#fff7ed_100%)] dark:bg-[linear-gradient(160deg,#0b1120_0%,#1a1033_55%,#2a1220_100%)]" />
      <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-violet-400/40 blur-3xl dark:bg-violet-600/30" />
      <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-pink-300/40 blur-3xl dark:bg-pink-600/25" />
      <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-orange-300/40 blur-3xl dark:bg-orange-500/20" />
      {/* Trame fine, comme sur les affiches */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.08]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(124,58,237,.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(124,58,237,.08) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className={panel ? 'relative flex flex-1 flex-col' : 'relative'}>
        {/* Marque */}
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand shadow-[0_8px_20px_rgba(124,58,237,0.35)]">
            <Eye className="h-5 w-5 text-white" strokeWidth={2.6} />
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight text-content">
            Oculo<span className="text-gradient">SaaS</span>
          </span>
        </div>

        {/* Composition : photo + cartes flottantes */}
        <div
          className={`relative mx-auto mt-5 h-[248px] w-full max-w-[340px] md:h-[360px] md:max-w-[480px] ${panel ? 'my-auto lg:h-[400px] xl:h-[440px] xl:max-w-[520px]' : ''}`}
          aria-hidden="true"
        >
          <div className="absolute left-1/2 top-2 h-[220px] w-[200px] -translate-x-1/2 md:h-[320px] md:w-[290px] xl:h-[380px] xl:w-[340px] rotate-[-3deg] overflow-hidden rounded-[28px] border-4 border-white shadow-[0_24px_50px_rgba(76,29,149,0.28)] dark:border-white/10">
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
        <h1 className={`mt-5 text-center font-display text-[26px] font-extrabold leading-tight tracking-tight text-content md:text-4xl ${panel ? 'xl:text-[42px]' : ''}`}>
          {tr('auth.heroTitleA')} <span className="text-gradient">{tr('auth.heroTitleB')}</span>
        </h1>
        {children}
      </div>
    </div>
  );
}
