import { Logo } from './Logo';
import { Mascot } from './brand/Mascot';
import { tr } from '../lib/tr';

/** Écran de chargement : Oculo patiente pendant qu'une jauge façon XP se remplit. */
export function BrandSplash() {
  return (
    <div className="grid h-full min-h-screen place-items-center bg-bg">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <Mascot className="w-[120px]" />
        <Logo />
        <div className="h-3 w-48 overflow-hidden rounded-full bg-surface-3 p-0.5">
          <div className="h-full w-1/2 animate-[slide-in_1s_ease-in-out_infinite] rounded-full bg-brand" />
        </div>
        <p className="text-sm font-semibold text-content-muted">{tr('ui.BrandSplash.chargementDeVotreEspace')}</p>
      </div>
    </div>
  );
}
