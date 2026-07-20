import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Sun, Moon, Monitor, Globe, ImagePlus, Trash2, Building2, Save, ShieldCheck, FileText, Eye, User, Contact, LifeBuoy, Glasses, MessageCircle } from 'lucide-react';
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
import { RestartTourCard } from '../../features/tour';
import { printSaleDocument } from '../../features/optique/saleDocument';
import type { SaleDetail } from '../../features/optique/api';
import type { InvoiceSettings, LensPricing } from '@oculo/shared-types';
import { DEFAULT_LENS_PRICING, SALE_WA_STAGES, DEFAULT_WA_TEMPLATES } from '@oculo/shared-types';
import { Avatar } from '../../components/Avatar';
import { Logo } from '../../components/Logo';
import { PageHeader, Badge, Button, Field, PasswordInput } from '../../components/ui';

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
    { key: 'profil', label: 'Mon profil', icon: User, show: true },
    { key: 'marque', label: 'Image de marque', icon: Building2, show: canBranding },
    { key: 'documents', label: 'Personnalisation des documents', icon: FileText, show: canBranding },
  ].filter((tb) => tb.show);
  const requested = params.get('tab') ?? 'profil';
  const active = TABS.some((tb) => tb.key === requested) ? requested : 'profil';

  return (
    <div>
      <PageHeader title="Réglages" subtitle={t('nav.profile')} />

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
        <RestartTourCard />
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
            <h3 className="font-display font-bold text-content">Bouton d'aide</h3>
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-content-muted">
            <input
              type="checkbox"
              checked={!supportHidden}
              onChange={(e) => setSupportHidden(!e.target.checked)}
            />
            Afficher le bouton « Besoin d'aide ? » flottant
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

            <div className="mt-4 max-w-2xl">
              <Field label="Situation géographique">
                <div className="flex gap-2">
                  <input
                    className="input"
                    placeholder="Adresse ou lien Google Maps (ex : Cocody, Rue des Jardins, Abidjan)"
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
                <h4 className="font-semibold text-content">Contact de l'entreprise</h4>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Téléphone">
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
                  <Save className="h-4 w-4" /> Enregistrer le contact
                </Button>
              </div>
            </div>

            <div className="mt-4 max-w-2xl border-t pt-4">
              <Field label="Taux de TVA (%) — 0 = exonéré">
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
                    <Save className="h-4 w-4" /> Enregistrer
                  </Button>
                </div>
              </Field>
              <p className="mt-1 text-xs text-content-faint">
                Appliqué à la caisse, aux devis et aux factures. Défaut : 18 %.
              </p>
            </div>

            <p className="mt-3 text-xs text-content-faint">
              Le logo et le nom apparaissent dans la barre latérale et l'en-tête de votre espace.
            </p>
          </div>
        </div>
      )}

      {active === 'documents' && canBranding && (
        <div className="space-y-4">
          <InvoiceCustomizationCard />
          <LensPricingCard />
          <WhatsappTemplatesCard />
        </div>
      )}
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
        <h3 className="font-display font-bold text-content">Messages WhatsApp</h3>
      </div>
      <p className="mb-4 text-xs text-content-faint">
        Message pré-rempli proposé à chaque étape de la vente. Variables disponibles :{' '}
        <code className="rounded bg-surface-2 px-1">{'{client}'}</code>{' '}
        <code className="rounded bg-surface-2 px-1">{'{etablissement}'}</code>{' '}
        <code className="rounded bg-surface-2 px-1">{'{numero}'}</code>{' '}
        <code className="rounded bg-surface-2 px-1">{'{montant}'}</code>{' '}
        <code className="rounded bg-surface-2 px-1">{'{reste}'}</code>. L'envoi reste manuel
        (WhatsApp s'ouvre avec le texte prêt, vous appuyez sur Envoyer).
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
          <Save className="h-4 w-4" /> Enregistrer
        </Button>
        {saved && <span className="text-sm text-success">Modèles enregistrés.</span>}
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

  const field = (key: keyof LensPricing, label: string) => (
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

  async function save() {
    setBusy(true);
    try {
      await updateBranding({ lensPricing: p });
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
        <h3 className="font-display font-bold text-content">Tarifs des verres</h3>
      </div>
      <p className="mb-4 text-xs text-content-faint">
        Prix par verre utilisés par le configurateur de commandes. Le total facturé
        est calculé pour une paire, avec l'indice d'amincissement choisi.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {field('unifocal', 'Unifocal')}
        {field('progressif', 'Progressif')}
        {field('degressif', 'Dégressif (bureau)')}
        {field('ar', 'Anti-reflet')}
        {field('blue', 'Anti-lumière bleue')}
        {field('photo', 'Photochromique')}
        {field('hard', 'Durci anti-rayures')}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save} loading={busy}>
          <Save className="h-4 w-4" /> Enregistrer
        </Button>
        {saved && <span className="text-sm text-success">Tarifs enregistrés.</span>}
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
      currency: 'XOF',
      createdAt: now,
      items: [
        { id: '1', quantity: 1, unitPrice: '75000', lineTotal: '75000', product: { name: 'Monture Ray-Ban RB5154', sku: 'RB-5154' } },
        { id: '2', quantity: 2, unitPrice: '10000', lineTotal: '20000', product: { name: 'Verre unifocal anti-reflet', sku: 'VERR-UNI' } },
      ],
      customer: { firstName: 'Awa', lastName: 'Diop', phone: '+225 07 00 00 00 00', email: null },
      branch: {
        name: branding?.name || user?.tenantName || 'Optique Vision Plus',
        city: 'Abidjan',
        address: 'Cocody, Rue des Jardins',
        phone: '+225 27 22 00 00 00',
      },
      cashier: { firstName: 'Koffi', lastName: "N'Guessan" },
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
        <h3 className="font-display font-bold text-content">Personnalisation des documents</h3>
      </div>
      <p className="mb-4 text-sm text-content-muted">
        S'applique à toutes vos factures et devis imprimés (le logo est géré ci-dessus).
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Couleur d'accent">
          <label className="mb-2 flex items-center gap-2 text-sm text-content-muted">
            <input type="checkbox" checked={useColor} onChange={(e) => setUseColor(e.target.checked)} />
            Utiliser une couleur personnalisée
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

        <Field label="Validité des devis (jours)">
          <input
            type="number"
            min={1}
            max={365}
            className="input"
            value={validity}
            onChange={(e) => setValidity(e.target.value)}
          />
        </Field>

        <Field label="Mentions légales (RCCM, NINEA/IFU…)">
          <textarea
            className="input min-h-[80px]"
            value={legalInfo}
            maxLength={300}
            onChange={(e) => setLegalInfo(e.target.value)}
            placeholder="RCCM CI-ABJ-2024-B-12345 · NINEA 001234567"
          />
        </Field>

        <Field label="Note de bas de page">
          <textarea
            className="input min-h-[80px]"
            value={footerNote}
            maxLength={300}
            onChange={(e) => setFooterNote(e.target.value)}
            placeholder="Merci de votre confiance. Aucun échange après 7 jours sans le ticket."
          />
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={save} loading={busy}>
          <Save className="h-4 w-4" /> Enregistrer
        </Button>
        <Button variant="outline" onClick={preview}>
          <Eye className="h-4 w-4" /> Aperçu (devis)
        </Button>
      </div>
    </div>
  );
}

function ChangePasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});

  async function submit() {
    setMsg({});
    if (next.length < 8) {
      setMsg({ err: 'Le nouveau mot de passe doit faire au moins 8 caractères.' });
      return;
    }
    if (next !== confirm) {
      setMsg({ err: 'La confirmation ne correspond pas.' });
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
      setMsg({ ok: 'Mot de passe modifié. Vos autres appareils ont été déconnectés.' });
      setCurrent('');
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
        <h3 className="font-display font-bold text-content">Mot de passe</h3>
      </div>
      <div className="max-w-sm space-y-3">
        <Field label="Mot de passe actuel">
          <PasswordInput
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <Field label="Nouveau mot de passe">
          <PasswordInput
            autoComplete="new-password"
            placeholder="Au moins 8 caractères"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </Field>
        <Field label="Confirmer le nouveau mot de passe">
          <PasswordInput
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        {msg.err && <p className="text-sm text-danger">{msg.err}</p>}
        {msg.ok && <p className="text-sm text-success">{msg.ok}</p>}
        <Button onClick={submit} loading={busy} disabled={!current || !next || !confirm}>
          Changer le mot de passe
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
