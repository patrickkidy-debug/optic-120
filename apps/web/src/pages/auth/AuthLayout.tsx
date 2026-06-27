import { type ReactNode } from 'react';
import { ShieldCheck, Smartphone, Store } from 'lucide-react';
import { Logo } from '../../components/Logo';

const FEATURES = [
  { icon: Smartphone, text: 'Paiements Mobile Money — Wave, Orange, MTN, Moov, Free' },
  { icon: Store, text: 'Multi-magasins, multi-cliniques & multi-utilisateurs' },
  { icon: ShieldCheck, text: 'Données isolées, chiffrées et conformes' },
];

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-hero p-12 lg:flex">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-30 blur-3xl"
          style={{ background: 'var(--gradient-brand)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-24 left-12 h-72 w-72 rounded-full opacity-20 blur-3xl"
          style={{ background: 'var(--accent)' }}
        />
        <Logo />
        <div className="relative">
          <h1 className="font-display text-4xl font-extrabold leading-tight text-content">
            La gestion <span className="text-gradient">premium</span>
            <br />
            de votre optique & clinique
          </h1>
          <p className="mt-4 max-w-md text-content-muted">
            Une plateforme SaaS moderne pensée pour les opticiens et ophtalmologues d'Afrique de
            l'Ouest.
          </p>
          <ul className="mt-8 space-y-4">
            {FEATURES.map((f) => (
              <li key={f.text} className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-primary">
                  <f.icon className="h-5 w-5" />
                </span>
                <span className="text-sm text-content">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-content-faint">© 2026 OculoSaaS — Afrique de l'Ouest</p>
      </div>

      <div className="flex items-center justify-center bg-bg p-6">
        <div className="w-full max-w-md animate-fade-in">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h2 className="font-display text-2xl font-bold text-content">{title}</h2>
          <p className="mt-1 text-sm text-content-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
