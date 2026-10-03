import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Sun, Moon, Monitor, Globe, ImagePlus, Trash2, Building2, Save, ShieldCheck, FileText, Eye, User, Contact, LifeBuoy, Glasses, MessageCircle, Plus } from 'lucide-react';
import { useAuthStore, usePermission } from '../../store/auth';
import { useUIStore } from '../../store/ui';
import type { ThemeMode } from '../../lib/theme';
import i18n, { LOCALES } from '../../lib/i18n';
import { fileToResizedDataUrl } from '../../lib/image';
import { apiErrorMessage } from '../../lib/api';
import {
  updateProfile,
  changePassword,
  getTwoFactorStatus,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
} from '../../features/auth/api';
import { getBranding, updateBranding } from '../../features/settings/api';
import { WatchDemoCard } from '../../features/demo/WatchDemoCard';
import { printSaleDocument } from '../../features/optique/saleDocument';
import type { SaleDetail } from '../../features/optique/api';
import type { InvoiceSettings, LensPricing, OpticalSettings } from '@oculo/shared-types';
import { DEFAULT_LENS_PRICING, SALE_WA_STAGES, DEFAULT_WA_TEMPLATES, DEFAULT_OPTICAL_SETTINGS } from '@oculo/shared-types';
import { Avatar } from '../../components/Avatar';
import { Logo } from '../../components/Logo';
import { PageHeader, Badge, Button, Field, PasswordInput } from '../../components/ui';
import { currencySymbol, getActiveCurrency } from '../../lib/format';
import { tr } from '../../lib/tr';

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
  const supportHidden = useUIStore((s) => s.supportWidgetHidden);
  const setSupportHidden = useUIStore((s) => s.setSupportWidgetHidden);

  const canBranding = usePermission('settings.branches.update');
  const { data: branding } = useQuery({ queryKey: ['branding'], queryFn: getBranding, enabled: canBranding });

  const [photoBusy, setPhotoBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [locBusy, setLocBusy] = useState(false);
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactBusy, setContactBusy] = useState(false);
  const [vat, setVat] = useState('18');
  const [vatBusy, setVatBusy] = useState(false);
  const [locHydrated, setLocHydrated] = useState(false);

  // Pré-remplit situation géographique + contact dès l'arrivée des réglages (une fois).
  useEffect(() => {
    if (branding && !locHydrated) {
      setLocation(branding.location ?? '');
      setContactPhone(branding.contactPhone ?? '');
      setContactEmail(branding.contactEmail ?? '');
      setVat(String(branding.vatRate ?? 18));
      setLocHydrated(true);
    }
  }, [branding, locHydrated]);

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
  async function saveLocation() {
    setLocBusy(true);
    try {
      await updateBranding({ location: location.trim() });
      qc.invalidateQueries({ queryKey: ['branding'] });
    } catch (e) {
      alert(apiErrorMessage(e));
    } finally {
      setLocBusy(false);
    }
  }
  async function saveContact() {
    setContactBusy(true);
    try {
      await updateBranding({ contactPhone: contactPhone.trim(), contactEmail: contactEmail.trim() });
      qc.invalidateQueries({ queryKey: ['branding'] });
    } catch (e) {
      alert(apiErrorMessage(e));
    } finally {
      setContactBusy(false);
    }
  }
  async function saveVat() {
    const v = Math.min(100, Math.max(0, Number(vat) || 0));
    setVatBusy(true);
    try {
      await updateBranding({ vatRate: v });
      qc.invalidateQueries({ queryKey: ['branding'] });
    } catch (e) {
      alert(apiErrorMessage(e));
    } finally {
      setVatBusy(false);
    }
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

  // Onglets de la section Réglages (les onglets marque/documents sont réservés
  // aux gestionnaires). L'onglet actif est mémorisé dans l'URL (?tab=…).
  const [params, setParams] = useSearchParams();
  const TABS = [
    { key: 'profil', label: tr('ui.ProfilePage.monProfil'), icon: User, show: true },
    { key: 'marque', label: tr('ui.ProfilePage.imageDeMarque'), icon: Building2, show: canBranding },
    { key: 'documents', label: tr('ui.ProfilePage.personnalisationDesDocuments'), icon: FileText, show: canBranding },
  ].filter((tb) => tb.show);
  const requested = params.get('tab') ?? 'profil';
  const active = TABS.some((tb) => tb.key === requested) ? requested : 'profil';

  return (
    <div>
      <PageHeader title={tr('ui.ProfilePage.reglages')} subtitle={t('nav.profile')} />

      <div className="mb-5 flex flex-wrap gap-1 border-b">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setParams({ tab: tb.key }, { replace: true })}
            className={clsx(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition',
              active === tb.key
                ? 'border-primary text-primary'
                : 'border-transparent text-content-muted hover:text-content',
            )}
          >
            <tb.icon className="h-4 w-4" /> {tb.label}
          </button>
        ))}
      </div>

      {active === 'profil' && (
      <div className="mb-4">
        <WatchDemoCard compact />
      </div>
      )}

      {active === 'profil' && (
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
                    title={tr('ui.ProfilePage.changerLaPhoto')}
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
                <Trash2 className="h-3 w-3" /> {tr('ui.ProfilePage.retirerLaPhoto')}
              </button>
            )}
            <p className="mt-3 text-xs text-content-faint">
              {tr('ui.ProfilePage.pngOuJpegRedimensionneeAutomatiquement')}
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
          <div className="mt-3 flex flex-wrap gap-2">
            {LOCALES.map((l) => (
              <button
                key={l.code}
                onClick={() => changeLocale(l.code)}
                className={`btn-outline ${locale === l.code ? 'border-primary text-primary' : ''}`}
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-primary" />
            <h3 className="font-display font-bold text-content">{tr('ui.ProfilePage.boutonDAide')}</h3>
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-content-muted">
            <input
              type="checkbox"
              checked={!supportHidden}
              onChange={(e) => setSupportHidden(!e.target.checked)}
            />
            {tr('ui.ProfilePage.afficherLeBoutonBesoinD')}
          </label>
        </div>

        {/* Sécurité — Mot de passe */}
        <div className="lg:col-span-3">
          <ChangePasswordCard />
        </div>

        {/* Sécurité — Double authentification (2FA) */}
        <div className="lg:col-span-3">
          <TwoFactorCard />
        </div>
      </div>
      )}

      {active === 'marque' && canBranding && (
        <div className="max-w-3xl">
          <div className="card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <h3 className="font-display font-bold text-content">{tr('ui.ProfilePage.imageDeMarque')}</h3>
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
                        <ImagePlus className="h-4 w-4" /> {tr('ui.ProfilePage.changerLeLogo')}
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
                <Field label={tr('ui.ProfilePage.nomDeLEtablissement')}>
                  <div className="flex gap-2">
                    <input
                      className="input"
                      placeholder={branding?.name ?? tr('ui.ProfilePage.nomDeLEtablissement')}
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
                <p className="mb-2 text-xs text-content-faint">{tr('ui.ProfilePage.apercu')}</p>
                <Logo />
              </div>
            </div>

            <div className="mt-4 max-w-2xl">
              <Field label={tr('ui.ProfilePage.situationGeographique')}>
                <div className="flex gap-2">
                  <input
                    className="input"
                    placeholder={tr('ui.ProfilePage.adresseOuLienGoogleMaps')}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                  <Button onClick={saveLocation} loading={locBusy}>
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
              </Field>
            </div>

            <div className="mt-4 max-w-2xl border-t pt-4">
              <div className="mb-3 flex items-center gap-2">
                <Contact className="h-4 w-4 text-primary" />
                <h4 className="font-semibold text-content">{tr('ui.ProfilePage.contactDeLEntreprise')}</h4>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={tr('ui.ProfilePage.telephone')}>
                  <input
                    className="input"
                    type="tel"
                    placeholder="+225 07 00 00 00 00"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                  />
                </Field>
                <Field label="Email">
                  <input
                    className="input"
                    type="email"
                    placeholder="contact@etablissement.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                  />
                </Field>
              </div>
              <div className="mt-3">
                <Button onClick={saveContact} loading={contactBusy}>
                  <Save className="h-4 w-4" /> {tr('ui.ProfilePage.enregistrerLeContact')}
                </Button>
              </div>
            </div>

            <div className="mt-4 max-w-2xl border-t pt-4">
              <Field label={tr('ui.ProfilePage.tauxDeTva0Exonere')}>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    className="input w-32 text-right"
                    value={vat}
                    onChange={(e) => setVat(e.target.value)}
                  />
                  <span className="text-sm text-content-muted">%</span>
                  <Button onClick={saveVat} loading={vatBusy}>
                    <Save className="h-4 w-4" /> {tr('ui.ProfilePage.enregistrer')}
                  </Button>
                </div>
              </Field>
              <p className="mt-1 text-xs text-content-faint">
                {tr('ui.ProfilePage.appliqueALaCaisseAux')}
              </p>
            </div>

            <p className="mt-3 text-xs text-content-faint">
              {tr('ui.ProfilePage.leLogoEtLeNom')}
            </p>
          </div>
        </div>
      )}

      {active === 'documents' && canBranding && (
        <div className="space-y-4">
          <OpticalSettingsCard />
          <InvoiceCustomizationCard />
          <LensPricingCard />
          <WhatsappTemplatesCard />
        </div>
      )}
    </div>
  );
}

/**
 * Réglages métier du cabinet : validité des ordonnances, délais de relance,
 * garantie proposée par défaut et valeur du point de fidélité. Remplacent les
 * valeurs qui étaient codées en dur.
 */
function OpticalSettingsCard() {
  const qc = useQueryClient();
  const { data: branding } = useQuery({ queryKey: ['branding'], queryFn: getBranding });
  const [form, setForm] = useState<OpticalSettings | null>(null);
  const [saved, setSaved] = useState(false);

  // Valeurs du serveur au premier chargement, puis état local pendant l'édition.
  const values = form ?? { ...DEFAULT_OPTICAL_SETTINGS, ...(branding?.opticalSettings ?? {}) };
  const set = (patch: Partial<OpticalSettings>) => setForm({ ...values, ...patch });

  const mut = useMutation({
    mutationFn: () => updateBranding({ opticalSettings: values }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branding'] });
      // Les relances dépendent de ces seuils.
      qc.invalidateQueries({ queryKey: ['renewals'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (e) => alert(apiErrorMessage(e)),
  });

  const Row = ({
    label,
    hint,
    value,
    onChange,
    suffix,
    min = 0,
  }: {
    label: string;
    hint: string;
    value: number;
    onChange: (n: number) => void;
    suffix: string;
    min?: number;
  }) => (
    <div className="flex items-center justify-between gap-3 border-b py-2.5 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-content">{label}</p>
        <p className="text-xs text-content-faint">{hint}</p>
      </div>
      <span className="flex shrink-0 items-center gap-1.5">
        <input
          type="number"
          min={min}
          value={value}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
          className="input h-9 w-24 text-right"
        />
        <span className="text-xs text-content-faint">{suffix}</span>
      </span>
    </div>
  );

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <Glasses className="h-5 w-5 text-primary" />
        <h3 className="font-display font-bold text-content">{tr('ui.ProfilePage.reglagesDuCabinet')}</h3>
      </div>
      <p className="mb-3 text-xs text-content-faint">
        {tr('ui.ProfilePage.pilotentLaValiditeDesOrdonnances')}
      </p>

      <Row
        label={tr('ui.ProfilePage.validiteDUneOrdonnance')}
        hint={tr('ui.ProfilePage.dureeApresLaquelleUneOrdonnance')}
        value={values.prescriptionValidityMonths}
        onChange={(n) => set({ prescriptionValidityMonths: n })}
        suffix="mois"
        min={1}
      />
      <Row
        label={tr('ui.ProfilePage.relanceNouvelleOrdonnance')}
        hint={tr('ui.ProfilePage.leClientApparaitDansRenouvellements')}
        value={values.prescriptionReminderMonths}
        onChange={(n) => set({ prescriptionReminderMonths: n })}
        suffix="mois"
        min={1}
      />
      <Row
        label={tr('ui.ProfilePage.relanceSansAchat')}
        hint={tr('ui.ProfilePage.leClientApparaitDansRenouvellements2')}
        value={values.purchaseReminderMonths}
        onChange={(n) => set({ purchaseReminderMonths: n })}
        suffix="mois"
        min={1}
      />
      <Row
        label={tr('ui.ProfilePage.garantieParDefaut')}
        hint={tr('ui.ProfilePage.proposeeAutomatiquementEnCaisse0')}
        value={values.defaultWarrantyMonths}
        onChange={(n) => set({ defaultWarrantyMonths: n })}
        suffix="mois"
      />
      <Row
        label={tr('ui.ProfilePage.valeurDUnPointDe')}
        hint={tr('ui.ProfilePage.remiseObtenueParPointUtilise')}
        value={values.loyaltyPointValue}
        onChange={(n) => set({ loyaltyPointValue: n })}
        suffix={currencySymbol()}
      />

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={() => mut.mutate()} loading={mut.isPending}>
          <Save className="h-4 w-4" /> {tr('ui.ProfilePage.enregistrer')}
        </Button>
        {saved && <span className="text-sm text-success">{tr('ui.ProfilePage.enregistre')}</span>}
      </div>
    </div>
  );
}

/** Modèles de messages WhatsApp envoyés à chaque étape du parcours de vente. */
function WhatsappTemplatesCard() {
  const qc = useQueryClient();
  const { data: branding } = useQuery({ queryKey: ['branding'], queryFn: getBranding });
  const [tpl, setTpl] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (branding && !hydrated) {
      const merged: Record<string, string> = {};
      for (const s of SALE_WA_STAGES) {
        merged[s.key] = branding.whatsappTemplates?.[s.key] ?? DEFAULT_WA_TEMPLATES[s.key];
      }
      setTpl(merged);
      setHydrated(true);
    }
  }, [branding, hydrated]);

  async function save() {
    setBusy(true);
    try {
      await updateBranding({ whatsappTemplates: tpl as Parameters<typeof updateBranding>[0]['whatsappTemplates'] });
      qc.invalidateQueries({ queryKey: ['branding'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      alert(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary" />
        <h3 className="font-display font-bold text-content">{tr('ui.ProfilePage.messagesWhatsapp')}</h3>
      </div>
      <p className="mb-4 text-xs text-content-faint">
        {tr('ui.ProfilePage.messagePreRempliProposeA')}{' '}
        <code className="rounded bg-surface-2 px-1">{'{client}'}</code>{' '}
        <code className="rounded bg-surface-2 px-1">{'{etablissement}'}</code>{' '}
        <code className="rounded bg-surface-2 px-1">{'{numero}'}</code>{' '}
        <code className="rounded bg-surface-2 px-1">{'{montant}'}</code>{' '}
        <code className="rounded bg-surface-2 px-1">{'{reste}'}</code>{tr('ui.ProfilePage.lEnvoiResteManuelWhatsapp')}
      </p>

      <div className="space-y-3">
        {SALE_WA_STAGES.map((s) => (
          <Field key={s.key} label={s.label}>
            <textarea
              rows={2}
              className="input resize-y"
              value={tpl[s.key] ?? ''}
              onChange={(e) => setTpl((prev) => ({ ...prev, [s.key]: e.target.value }))}
            />
          </Field>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save} loading={busy}>
          <Save className="h-4 w-4" /> {tr('ui.ProfilePage.enregistrer')}
        </Button>
        {saved && <span className="text-sm text-success">{tr('ui.ProfilePage.modelesEnregistres')}</span>}
      </div>
    </div>
  );
}

/** Tarifs verres/traitements propres à la boutique (configurateur de commandes). */
function LensPricingCard() {
  const qc = useQueryClient();
  const { data: branding } = useQuery({ queryKey: ['branding'], queryFn: getBranding });
  const [p, setP] = useState<LensPricing>(DEFAULT_LENS_PRICING);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (branding?.lensPricing) setP({ ...DEFAULT_LENS_PRICING, ...branding.lensPricing });
  }, [branding]);

  const field = (key: Exclude<keyof LensPricing, 'customTypes'>, label: string) => (
    <Field label={label}>
      <input
        type="number"
        min={0}
        className="input text-right"
        value={p[key]}
        onChange={(e) => setP((prev) => ({ ...prev, [key]: Number(e.target.value) || 0 }))}
      />
    </Field>
  );

  const custom = p.customTypes ?? [];
  function addCustom() {
    const id = `custom-${Math.random().toString(36).slice(2, 8)}`;
    setP((prev) => ({ ...prev, customTypes: [...(prev.customTypes ?? []), { id, name: '', price: 0 }] }));
  }
  function updateCustom(id: string, patch: Partial<{ name: string; price: number }>) {
    setP((prev) => ({
      ...prev,
      customTypes: (prev.customTypes ?? []).map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }
  function removeCustom(id: string) {
    setP((prev) => ({ ...prev, customTypes: (prev.customTypes ?? []).filter((c) => c.id !== id) }));
  }

  async function save() {
    setBusy(true);
    try {
      // On ne garde que les types personnalisés réellement nommés.
      const clean: LensPricing = {
        ...p,
        customTypes: (p.customTypes ?? [])
          .map((c) => ({ ...c, name: c.name.trim() }))
          .filter((c) => c.name.length > 0),
      };
      await updateBranding({ lensPricing: clean });
      qc.invalidateQueries({ queryKey: ['branding'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      alert(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <Glasses className="h-5 w-5 text-primary" />
        <h3 className="font-display font-bold text-content">{tr('ui.ProfilePage.tarifsDesVerres')}</h3>
      </div>
      <p className="mb-4 text-xs text-content-faint">
        {tr('ui.ProfilePage.prixParVerreUtilisesPar')}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {field('unifocal', 'Unifocal')}
        {field('progressif', 'Progressif')}
        {field('degressif', tr('ui.ProfilePage.degressifBureau'))}
        {field('ar', 'Anti-reflet')}
        {field('blue', tr('ui.ProfilePage.antiLumiereBleue'))}
        {field('photo', 'Photochromique')}
        {field('hard', tr('ui.ProfilePage.durciAntiRayures'))}
      </div>

      {/* Types de verres ajoutés manuellement par l'établissement. */}
      <div className="mt-5 border-t pt-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-content-faint">
            {tr('ui.ProfilePage.vosTypesDeVerres')}
          </p>
          <Button variant="outline" onClick={addCustom} className="h-8 px-2.5 text-xs">
            <Plus className="h-3.5 w-3.5" /> {tr('ui.ProfilePage.ajouterUnType')}
          </Button>
        </div>
        {custom.length === 0 ? (
          <p className="text-xs text-content-faint">
            {tr('ui.ProfilePage.ajoutezVosPropresTypesDe')}
          </p>
        ) : (
          <div className="space-y-2">
            {custom.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <input
                  className="input flex-1"
                  placeholder={tr('ui.ProfilePage.nomDuTypeExBifocal')}
                  value={c.name}
                  onChange={(e) => updateCustom(c.id, { name: e.target.value })}
                />
                <input
                  type="number"
                  min={0}
                  className="input w-32 text-right"
                  placeholder={tr('ui.ProfilePage.prix')}
                  value={c.price}
                  onChange={(e) => updateCustom(c.id, { price: Number(e.target.value) || 0 })}
                />
                <button
                  type="button"
                  onClick={() => removeCustom(c.id)}
                  className="btn-ghost h-9 w-9 shrink-0 rounded-lg p-0 text-danger"
                  title={tr('ui.ProfilePage.supprimerCeType')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save} loading={busy}>
          <Save className="h-4 w-4" /> {tr('ui.ProfilePage.enregistrer')}
        </Button>
        {saved && <span className="text-sm text-success">{tr('ui.ProfilePage.tarifsEnregistres')}</span>}
      </div>
    </div>
  );
}

function InvoiceCustomizationCard() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { data: branding } = useQuery({ queryKey: ['branding'], queryFn: getBranding });

  const [useColor, setUseColor] = useState(false);
  const [accentColor, setAccentColor] = useState('#0d9488');
  const [legalInfo, setLegalInfo] = useState('');
  const [footerNote, setFooterNote] = useState('');
  const [validity, setValidity] = useState('30');
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Pré-remplit le formulaire à l'arrivée des réglages existants (une seule fois).
  useEffect(() => {
    if (!branding || hydrated) return;
    const iv = branding.invoiceSettings;
    if (iv?.accentColor) {
      setUseColor(true);
      setAccentColor(iv.accentColor);
    }
    setLegalInfo(iv?.legalInfo ?? '');
    setFooterNote(iv?.footerNote ?? '');
    setValidity(String(iv?.quoteValidityDays ?? 30));
    setHydrated(true);
  }, [branding, hydrated]);

  function buildSettings(): InvoiceSettings {
    const out: InvoiceSettings = {};
    if (useColor && /^#[0-9a-fA-F]{6}$/.test(accentColor)) out.accentColor = accentColor;
    if (legalInfo.trim()) out.legalInfo = legalInfo.trim();
    if (footerNote.trim()) out.footerNote = footerNote.trim();
    const v = parseInt(validity, 10);
    if (Number.isFinite(v) && v > 0 && v !== 30) out.quoteValidityDays = v;
    return out;
  }

  async function save() {
    setBusy(true);
    try {
      await updateBranding({ invoiceSettings: buildSettings() });
      qc.invalidateQueries({ queryKey: ['branding'] });
    } catch (e) {
      alert(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // Aperçu instantané : un devis fictif rendu avec les réglages en cours d'édition.
  function preview() {
    const now = new Date().toISOString();
    const sample: SaleDetail = {
      id: 'preview',
      number: 'DEV-2026-0007',
      type: 'QUOTE',
      status: 'CONFIRMED',
      subtotal: '95000',
      discountAmount: '5000',
      taxAmount: '0',
      insuranceAmount: '0',
      totalAmount: '90000',
      paidAmount: '0',
      currency: getActiveCurrency(),
      createdAt: now,
      items: [
        { id: '1', productId: 'demo-1', quantity: 1, unitPrice: '75000', lineTotal: '75000', reference: null, product: { name: 'Monture Ray-Ban RB5154', sku: 'RB-5154' } },
        { id: '2', productId: 'demo-2', quantity: 2, unitPrice: '10000', lineTotal: '20000', reference: null, product: { name: 'Verre unifocal anti-reflet', sku: 'VERR-UNI' } },
      ],
      customer: { firstName: tr('ui.ProfilePage.awa'), lastName: tr('ui.ProfilePage.diop'), phone: '+225 07 00 00 00 00', email: null },
      branch: {
        name: branding?.name || user?.tenantName || 'Optique Vision Plus',
        city: tr('ui.ProfilePage.abidjan'),
        address: tr('ui.ProfilePage.cocodyRueDesJardins'),
        phone: '+225 27 22 00 00 00',
      },
      cashier: { firstName: tr('ui.ProfilePage.koffi'), lastName: "N'Guessan" },
    };
    printSaleDocument(sample, {
      name: branding?.name || user?.tenantName || 'Votre établissement',
      logoUrl: branding?.logoUrl ?? user?.tenantLogoUrl,
      location: branding?.location ?? user?.tenantLocation,
      contactPhone: branding?.contactPhone ?? user?.tenantContactPhone,
      contactEmail: branding?.contactEmail ?? user?.tenantContactEmail,
      ...buildSettings(),
    });
  }

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <h3 className="font-display font-bold text-content">{tr('ui.ProfilePage.personnalisationDesDocuments')}</h3>
      </div>
      <p className="mb-4 text-sm text-content-muted">
        {tr('ui.ProfilePage.sAppliqueAToutesVos')}
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label={tr('ui.ProfilePage.couleurDAccent')}>
          <label className="mb-2 flex items-center gap-2 text-sm text-content-muted">
            <input type="checkbox" checked={useColor} onChange={(e) => setUseColor(e.target.checked)} />
            {tr('ui.ProfilePage.utiliserUneCouleurPersonnalisee')}
          </label>
          {useColor && (
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-10 w-16 cursor-pointer rounded-lg border bg-transparent"
              />
              <input
                className="input flex-1 font-mono"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                placeholder="#0d9488"
              />
            </div>
          )}
        </Field>

        <Field label={tr('ui.ProfilePage.validiteDesDevisJours')}>
          <input
            type="number"
            min={1}
            max={365}
            className="input"
            value={validity}
            onChange={(e) => setValidity(e.target.value)}
          />
        </Field>

        <Field label={tr('ui.ProfilePage.mentionsLegalesRccmNineaIfu')}>
          <textarea
            className="input min-h-[80px]"
            value={legalInfo}
            maxLength={300}
            onChange={(e) => setLegalInfo(e.target.value)}
            placeholder={tr('ui.ProfilePage.rccmCiAbj2024B')}
          />
        </Field>

        <Field label={tr('ui.ProfilePage.noteDeBasDePage')}>
          <textarea
            className="input min-h-[80px]"
            value={footerNote}
            maxLength={300}
            onChange={(e) => setFooterNote(e.target.value)}
            placeholder={tr('ui.ProfilePage.merciDeVotreConfianceAucun')}
          />
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={save} loading={busy}>
          <Save className="h-4 w-4" /> {tr('ui.ProfilePage.enregistrer')}
        </Button>
        <Button variant="outline" onClick={preview}>
          <Eye className="h-4 w-4" /> {tr('ui.ProfilePage.apercuDevis')}
        </Button>
      </div>
    </div>
  );
}

function ChangePasswordCard() {
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});

  async function submit() {
    setMsg({});
    if (next.length < 8) {
      setMsg({ err: tr('ui.ProfilePage.leNouveauMotDePasse') });
      return;
    }
    if (next !== confirm) {
      setMsg({ err: tr('ui.ProfilePage.laConfirmationNeCorrespondPas') });
      return;
    }
    setBusy(true);
    try {
      await changePassword(next);
      setMsg({ ok: tr('ui.ProfilePage.motDePasseModifieVos') });
      setNext('');
      setConfirm('');
    } catch (e) {
      setMsg({ err: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h3 className="font-display font-bold text-content">{tr('ui.ProfilePage.motDePasse')}</h3>
      </div>
      <p className="mb-3 max-w-sm text-sm text-content-muted">
        {tr('ui.ProfilePage.saisissezSimplementVotreNouveauMot')}
      </p>
      <div className="max-w-sm space-y-3">
        <Field label={tr('ui.ProfilePage.nouveauMotDePasse')}>
          <PasswordInput
            autoComplete="new-password"
            placeholder={tr('ui.ProfilePage.auMoins8Caracteres')}
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </Field>
        <Field label={tr('ui.ProfilePage.confirmerLeNouveauMotDe')}>
          <PasswordInput
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        {msg.err && <p className="text-sm text-danger">{msg.err}</p>}
        {msg.ok && <p className="text-sm text-success">{msg.ok}</p>}
        <Button onClick={submit} loading={busy} disabled={!next || !confirm}>
          {tr('ui.ProfilePage.changerLeMotDePasse')}
        </Button>
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
          <h3 className="font-display font-bold text-content">{tr('ui.ProfilePage.doubleAuthentification2fa')}</h3>
        </div>
        <Badge tone={enabled ? 'success' : 'neutral'}>{enabled ? tr('ui.ProfilePage.activee') : tr('ui.ProfilePage.desactivee')}</Badge>
      </div>

      {phase === 'idle' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-sm text-content-muted">
            {tr('ui.ProfilePage.ajoutezUneCoucheDeSecurite')}
          </p>
          {enabled ? (
            <Button variant="outline" className="text-danger" onClick={() => setPhase('disable')}>
              {tr('ui.ProfilePage.desactiver')}
            </Button>
          ) : (
            <Button onClick={startSetup} loading={busy}>{tr('ui.ProfilePage.activerLa2fa')}</Button>
          )}
        </div>
      )}

      {phase === 'setup' && (
        <div className="flex flex-wrap gap-6">
          <div className="text-center">
            {qr && <img src={qr} alt={tr('ui.ProfilePage.qr2fa')} className="h-44 w-44 rounded-xl bg-white p-2" />}
            <p className="mt-2 max-w-[200px] text-xs text-content-faint">
              {tr('ui.ProfilePage.scannezCeQrAvecVotre')}
            </p>
          </div>
          <div className="min-w-[240px] flex-1">
            <p className="text-sm text-content-muted">{tr('ui.ProfilePage.ouSaisieManuelleDeLa')}</p>
            <code className="mt-1 block break-all rounded-lg bg-surface-2 p-2 text-xs text-content">{secret}</code>
            <Field label={tr('ui.ProfilePage.codeDeVerification')}>
              <input
                className="input text-center text-xl tracking-[0.3em]"
                inputMode="numeric" maxLength={6} placeholder="······"
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
            </Field>
            {err && <p className="mt-1 text-sm text-danger">{err}</p>}
            <div className="mt-3 flex gap-2">
              <Button onClick={confirmEnable} loading={busy} disabled={code.length !== 6}>{tr('ui.ProfilePage.activer')}</Button>
              <Button variant="ghost" onClick={reset}>{tr('ui.ProfilePage.annuler')}</Button>
            </div>
          </div>
        </div>
      )}

      {phase === 'disable' && (
        <div className="max-w-sm space-y-3">
          <p className="text-sm text-content-muted">{tr('ui.ProfilePage.confirmezAvecVotreMotDe')}</p>
          <Field label={tr('ui.ProfilePage.motDePasse')}>
            <input className="input" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
          </Field>
          <Field label={tr('ui.ProfilePage.code2fa')}>
            <input
              className="input text-center text-xl tracking-[0.3em]"
              inputMode="numeric" maxLength={6} placeholder="······"
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
          {err && <p className="text-sm text-danger">{err}</p>}
          <div className="flex gap-2">
            <Button className="text-danger" variant="outline" onClick={confirmDisable} loading={busy} disabled={!pwd || code.length !== 6}>
              {tr('ui.ProfilePage.desactiverLa2fa')}
            </Button>
            <Button variant="ghost" onClick={reset}>{tr('ui.ProfilePage.annuler')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
