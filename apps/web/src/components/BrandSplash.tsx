import { Logo } from './Logo';

export function BrandSplash() {
  return (
    <div className="grid h-full min-h-screen place-items-center bg-hero">
      <div className="flex flex-col items-center gap-5 animate-fade-in">
        <Logo />
        <div className="h-1 w-32 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full w-1/2 animate-[slide-in_1s_ease-in-out_infinite] bg-brand" />
        </div>
        <p className="text-sm text-content-muted">Chargement de votre espace…</p>
      </div>
    </div>
  );
}
