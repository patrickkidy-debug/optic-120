import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sun, Moon, Monitor, Globe, ImagePlus, Trash2, Building2, Save, ShieldCheck } from 'lucide-react';
import { useAuthStore, usePermission } from '../../store/auth';
import { useUIStore } from '../../store/ui';
import type { ThemeMode } from '../../lib/theme';
import i18n from '../../lib/i18n';
import { fileToResizedDataUrl } from '../../lib/image';
import { apiErrorMessage } from '../../lib/api';
import {
  updateProfile,
  getTwoFactorStatus,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
} from '../../features/auth/api';
import { getBranding, updateBranding } from '../../features/settings/api';
import { Avatar } from '../../components/Avatar';
import { Logo } from '../../components/Logo';
import { PageHeader, Badge, Button, Field } from '../../components/ui';

function ImagePicker({
  onPick,
  busy,
  accept = 'image/png,image/jpeg,image/webp',
  children,
}: {
  onPick: (file: File) => void;
  busy?: boolean;
  accept?: string;
  children: (open: () => void) => ReactNode;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = '';
        }}
      />
      {children(() => !busy && ref.current?.click())}
    </>
  );
}

export function ProfilePage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const locale = useUIStore((s) => s.locale);
  const setLocale = useUIStore((s) => s.setLocale);

  const canBranding = usePermission('settings.branches.update');
  const { data: branding } = useQuery({ queryKey: ['branding'], queryFn: getBranding, enabled: canBranding });

  const [photoBusy, setPhotoBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [name, setName] = useState('');

  async function pickPhoto(file: File) {
    setPhotoBusy(true);
    try {
      const url = await fileToResizedDataUrl(file, 256);
      await updateProfile({ photoUrl: url });
    } catch (e) {
      alert(apiErrorMessage(e));
    } finally {
      setPhotoBusy(false);
    }
  }
  async function removePhoto() {
    setPhotoBusy(true);
    try {
      await updateProfile({ photoUrl: '' });
    } finally {
      setPhotoBusy(false);
    }
  }
  async function pickLogo(file: File) {
    setLogoBusy(true);
    try {
      const url = await fileToResizedDataUrl(file, 320);
      await updateBranding({ logoUrl: url });
      qc.invalidateQueries({ queryKey: ['branding'] });
    } catch (e) {
      alert(apiErrorMessage(e));
    } finally {
      setLogoBusy(false);
    }
  }
  async function removeLogo() {
    setLogoBusy(true);
    try {
      await updateBranding({ logoUrl: '' });
      qc.invalidateQueries({ queryKey: ['branding'] });
    } finally {
      setLogoBusy(false);
    }
  }
  async function saveName() {
    if (name.trim().length < 2) return;
    await updateBranding({ name: name.trim() });
    qc.invalidateQueries({ queryKey: ['branding'] });
    setName('');
  }

  const themes: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: 'dark', label: t('settings.themeDark'), icon: Moon },
    { value: 'light', label: t('settings.themeLight'), icon: Sun },
    { value: 'auto', label: t('settings.themeAuto'), icon: Monitor },
  ];

  function changeLocale(l: string) {
    setLocale(l);
    void i18n.changeLanguage(l);
  }

  return (
    <div>
      <PageHeader title={t('settings.title')} subtitle={t('nav.profile')} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Carte profil + photo */}
        <div className="card p-5">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <Avatar
                photoUrl={user?.photoUrl}
                firstName={user?.firstName}
                lastName={user?.lastName}
                className="h-24 w-24 rounded-2xl text-2xl"
              />
              <ImagePicker onPick={pickPhoto} busy={photoBusy}>
                {(open) => (
                  <button
                    onClick={open}
                    disabled={photoBusy}
                    className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-xl border-2 border-surface bg-primary text-white shadow-card transition hover:bg-primary-hover disabled:opacity-50"
                    title="Changer la photo"
                  >
                    <ImagePlus className="h-4 w-4" />
                  </button>
                )}
              </ImagePicker>
            </div>
            <h3 className="mt-3 font-display text-lg font-bold text-content">
              {user?.firstName} {user?.lastName}
            </h3>
            <p className="text-sm text-content-muted">{user?.email}</p>
            <div className="mt-2">
              <Badge tone="info">{user?.roleName}</Badge>
            </div>
            {user?.photoUrl && (
              <button
                onClick={removePhoto}
                disabled={photoBusy}
                className="mt-3 inline-flex items-center gap-1 text-xs text-content-muted hover:text-danger"
              >
                <Trash2 className="h-3 w-3" /> Retirer la photo
              </button>
            )}
            <p className="mt-3 text-xs text-content-faint">
              PNG ou JPEG — redimensionnée automatiquement.
            </p>
          </div>
        </div>

        {/* Apparence */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="mb-1 font-display font-bold text-content">{t('settings.appearance')}</h3>
          <p className="mb-4 text-sm text-content-muted">{t('settings.theme')}</p>
          <div className="grid grid-cols-3 gap-3">
            {themes.map((tm) => (
              <button
                key={tm.value}
                onClick={() => setTheme(tm.value)}
                className={`card flex flex-col items-center gap-2 p-4 transition ${
                  theme === tm.value ? 'border-primary shadow-glow' : 'hover:border-line-strong'
                }`}
              >
                <tm.icon className={`h-6 w-6 ${theme === tm.value ? 'text-primary' : 'text-content-muted'}`} />
                <span className="text-sm font-medium text-content">{tm.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <h3 className="font-display font-bold text-content">{t('settings.language')}</h3>
          </div>
          <div className="mt-3 flex gap-2">
            {[
              { code: 'fr', label: 'Français' },
              { code: 'en', label: 'English' },
            ].map((l) => (
              <button
                key={l.code}
                onClick={() => changeLocale(l.code)}
                className={`btn-outline ${locale === l.code ? 'border-primary text-primary' : ''}`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Image de marque (logo) — réservé aux gestionnaires */}
        {canBranding && (
          <div className="card p-5 lg:col-span-3">
            <div className="mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <h3 className="font-display font-bold text-content">Image de marque</h3>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-4">
                {branding?.logoUrl ? (
                  <img src={branding.logoUrl} alt="logo" className="h-16 w-16 rounded-2xl object-cover shadow-card" />
                ) : (
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-surface-2 text-content-faint">
                    <Building2 className="h-6 w-6" />
                  </div>
                )}
                <div className="flex gap-2">
                  <ImagePicker onPick={pickLogo} busy={logoBusy}>
                    {(open) => (
                      <Button variant="outline" onClick={open} loading={logoBusy}>
                        <ImagePlus className="h-4 w-4" /> Changer le logo
                      </Button>
                    )}
                  </ImagePicker>
                  {branding?.logoUrl && (
                    <Button variant="ghost" className="text-danger" onClick={removeLogo} disabled={logoBusy}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="min-w-[220px] flex-1">
                <Field label="Nom de l'établissement">
                  <div className="flex gap-2">
                    <input
                      className="input"
                      placeholder={branding?.name ?? "Nom de l'établissement"}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                    <Button onClick={saveName} disabled={name.trim().length < 2}>
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                </Field>
              </div>

              <div className="rounded-xl border bg-surface-2 p-3">
                <p className="mb-2 text-xs text-content-faint">Aperçu</p>
                <Logo />
              </div>
            </div>
            <p className="mt-3 text-xs text-content-faint">
              Le logo et le nom apparaissent dans la barre latérale et l'en-tête de votre espace.
            </p>
          </div>
        )}

        {/* Sécurité — Double authentification (2FA) */}
        <div className="lg:col-span-3">
          <TwoFactorCard />
        </div>
      </div>
    </div>
  );
}

function TwoFactorCard() {
  const qc = useQueryClient();
  const { data: enabled } = useQuery({ queryKey: ['2fa-status'], queryFn: getTwoFactorStatus });
  const [phase, setPhase] = useState<'idle' | 'setup' | 'disable'>('idle');
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const refresh = () => qc.invalidateQueries({ queryKey: ['2fa-status'] });
  const reset = () => { setPhase('idle'); setQr(''); setSecret(''); setCode(''); setPwd(''); setErr(''); };

  async function startSetup() {
    setErr(''); setBusy(true);
    try { const d = await setupTwoFactor(); setQr(d.qrDataUrl); setSecret(d.secret); setPhase('setup'); }
    catch (e) { setErr(apiErrorMessage(e)); } finally { setBusy(false); }
  }
  async function confirmEnable() {
    setErr(''); setBusy(true);
    try { await enableTwoFactor(code.trim()); refresh(); reset(); }
    catch (e) { setErr(apiErrorMessage(e)); } finally { setBusy(false); }
  }
  async function confirmDisable() {
    setErr(''); setBusy(true);
    try { await disableTwoFactor(pwd, code.trim()); refresh(); reset(); }
    catch (e) { setErr(apiErrorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h3 className="font-display font-bold text-content">Double authentification (2FA)</h3>
        </div>
        <Badge tone={enabled ? 'success' : 'neutral'}>{enabled ? 'Activée' : 'Désactivée'}</Badge>
      </div>

      {phase === 'idle' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-sm text-content-muted">
            Ajoutez une couche de sécurité : un code à 6 chiffres généré par une application
            (Google Authenticator, Authy…) sera demandé à chaque connexion.
          </p>
          {enabled ? (
            <Button variant="outline" className="text-danger" onClick={() => setPhase('disable')}>
              Désactiver
            </Button>
          ) : (
            <Button onClick={startSetup} loading={busy}>Activer la 2FA</Button>
          )}
        </div>
      )}

      {phase === 'setup' && (
        <div className="flex flex-wrap gap-6">
          <div className="text-center">
            {qr && <img src={qr} alt="QR 2FA" className="h-44 w-44 rounded-xl bg-white p-2" />}
            <p className="mt-2 max-w-[200px] text-xs text-content-faint">
              Scannez ce QR avec votre application d'authentification.
            </p>
          </div>
          <div className="min-w-[240px] flex-1">
            <p className="text-sm text-content-muted">Ou saisie manuelle de la clé :</p>
            <code className="mt-1 block break-all rounded-lg bg-surface-2 p-2 text-xs text-content">{secret}</code>
            <Field label="Code de vérification">
              <input
                className="input text-center text-xl tracking-[0.3em]"
                inputMode="numeric" maxLength={6} placeholder="······"
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
            </Field>
            {err && <p className="mt-1 text-sm text-danger">{err}</p>}
            <div className="mt-3 flex gap-2">
              <Button onClick={confirmEnable} loading={busy} disabled={code.length !== 6}>Activer</Button>
              <Button variant="ghost" onClick={reset}>Annuler</Button>
            </div>
          </div>
        </div>
      )}

      {phase === 'disable' && (
        <div className="max-w-sm space-y-3">
          <p className="text-sm text-content-muted">Confirmez avec votre mot de passe et un code 2FA.</p>
          <Field label="Mot de passe">
            <input className="input" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
          </Field>
          <Field label="Code 2FA">
            <input
              className="input text-center text-xl tracking-[0.3em]"
              inputMode="numeric" maxLength={6} placeholder="······"
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
          {err && <p className="text-sm text-danger">{err}</p>}
          <div className="flex gap-2">
            <Button className="text-danger" variant="outline" onClick={confirmDisable} loading={busy} disabled={!pwd || code.length !== 6}>
              Désactiver la 2FA
            </Button>
            <Button variant="ghost" onClick={reset}>Annuler</Button>
          </div>
        </div>
      )}
    </div>
  );
}
