import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Store, ImagePlus, Trash2, RefreshCw, Building2, Phone, Users, Clock, Info } from 'lucide-react';
import { SUPPORTED_COUNTRIES, WEEK_DAYS, type BranchCreateInput, type OpeningHours, type WeekDay } from '@oculo/shared-types';
import { Button } from '../../components/ui';
import { WhatsappField } from '../../components/WhatsappField';
import { useToast } from '../../components/Toast';
import { apiErrorMessage } from '../../lib/api';
import { tr } from '../../lib/tr';
import { listUsers, type UserDto } from '../rbac/api';
import { createBranchFull, nextBranchCode, setBranchTeam, updateBranch, type BranchRow } from './api';

type Form = {
  name: string;
  code: string;
  logoUrl: string;
  countryCode: string;
  city: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  managerId: string;
  openingHours: OpeningHours | null;
  team: string[];
};

const EMPTY_DAY = { open: '08:30', close: '19:00' };
const LOGO_MAX = 400 * 1024;

function fromBranch(b: BranchRow | null, country: string): Form {
  return {
    name: b?.name ?? '',
    code: b?.code ?? '',
    logoUrl: b?.logoUrl ?? '',
    countryCode: b?.countryCode ?? country,
    city: b?.city ?? '',
    address: b?.address ?? '',
    phone: b?.phone ?? '',
    whatsapp: b?.whatsapp ?? '',
    email: b?.email ?? '',
    managerId: b?.managerId ?? '',
    openingHours: b?.openingHours ?? null,
    team: [],
  };
}

type Errors = Partial<Record<'name' | 'code' | 'email' | 'hours' | 'logo', string>>;

function validate(f: Form): Errors {
  const e: Errors = {};
  if (f.name.trim().length < 2) e.name = tr('br.err.name');
  if (f.code && !/^[A-Z0-9][A-Z0-9_-]{1,19}$/.test(f.code.trim().toUpperCase())) e.code = tr('br.err.code');
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = tr('br.err.email');
  if (f.openingHours && Object.values(f.openingHours).some((d) => d && d.open >= d.close)) e.hours = tr('br.err.hours');
  return e;
}

/**
 * Création / modification d'un magasin dans un panneau latéral. Seul le nom
 * est obligatoire ; le reste peut être complété plus tard. Les saisies sont
 * conservées en cas d'erreur, et la fermeture d'un formulaire modifié demande
 * confirmation.
 */
export function BranchFormPanel({
  branch,
  tenantCountry,
  currency,
  canAssignTeam,
  selfId,
  selfAllBranches,
  onClose,
  onSaved,
}: {
  /** null = création. */
  branch: BranchRow | null;
  tenantCountry: string;
  currency: string;
  /** Droit d'affecter des collaborateurs (rbac.users.update). */
  canAssignTeam: boolean;
  selfId: string;
  selfAllBranches: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const isEdit = Boolean(branch);
  const toast = useToast();
  const initial = useMemo(() => fromBranch(branch, tenantCountry), [branch, tenantCountry]);
  const [form, setForm] = useState<Form>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState('');
  const [baseline, setBaseline] = useState(initial);
  const nameRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const { data: users } = useQuery({ queryKey: ['users'], queryFn: listUsers, staleTime: 60_000 });
  const activeUsers = (users ?? []).filter((u) => u.isActive);

  // Code interne proposé à la création (modifiable).
  const codeQuery = useQuery({ queryKey: ['branch-next-code'], queryFn: nextBranchCode, enabled: !isEdit, staleTime: 0 });
  useEffect(() => {
    if (!isEdit && codeQuery.data && !form.code) {
      setForm((f) => ({ ...f, code: codeQuery.data! }));
      setBaseline((b) => ({ ...b, code: codeQuery.data! }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeQuery.data]);

  useEffect(() => nameRef.current?.focus(), []);
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);

  function requestClose() {
    if (dirty && !confirm(tr('br.form.discard'))) return;
    onClose();
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
  // Quitter la page avec un formulaire modifié : avertissement du navigateur.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const dial = SUPPORTED_COUNTRIES.find((c) => c.code === form.countryCode)?.dial;

  const mut = useMutation({
    mutationFn: async () => {
      const payload: BranchCreateInput = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        countryCode: form.countryCode,
        city: form.city,
        address: form.address,
        phone: form.phone,
        whatsapp: form.whatsapp,
        email: form.email.trim(),
        managerId: form.managerId || null,
        openingHours: form.openingHours,
        ...(form.logoUrl !== initial.logoUrl ? { logoUrl: form.logoUrl } : {}),
      };
      if (isEdit) {
        await updateBranch(branch!.id, payload);
        return branch!.id;
      }
      const created = await createBranchFull(payload);
      // Équipe choisie à la création : le serveur a déjà affecté le responsable
      // (et le créateur s'il est limité à ses magasins) ; on garde ces accès.
      if (canAssignTeam && form.team.length) {
        const ids = new Set(form.team);
        if (form.managerId) ids.add(form.managerId);
        if (!selfAllBranches) ids.add(selfId);
        try {
          await setBranchTeam(created.id, [...ids]);
        } catch (e) {
          toast.error(tr('br.form.teamFailed', { msg: apiErrorMessage(e) }));
        }
      }
      return created.id;
    },
    onSuccess: (id) => {
      setBaseline(form);
      toast.success(isEdit ? tr('br.form.updated') : tr('br.form.created', { name: form.name.trim() }));
      onSaved(id);
    },
    onError: (e) => setServerError(apiErrorMessage(e)),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setServerError('');
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length) {
      const first = Object.keys(errs)[0];
      document.getElementById(`bf-${first}`)?.focus();
      return;
    }
    mut.mutate();
  }

  function onLogo(file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setErrors((x) => ({ ...x, logo: tr('br.err.logoType') }));
    if (file.size > LOGO_MAX) return setErrors((x) => ({ ...x, logo: tr('br.err.logoSize') }));
    const r = new FileReader();
    r.onload = () => {
      set('logoUrl', String(r.result));
      setErrors((x) => ({ ...x, logo: undefined }));
    };
    r.readAsDataURL(file);
  }

  const err = (k: keyof Errors) =>
    errors[k] ? (
      <p id={`bf-${k}-err`} className="mt-1 text-xs font-medium text-danger" role="alert">
        {errors[k]}
      </p>
    ) : null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="bf-title">
      <button type="button" aria-label={tr('br.close')} className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={requestClose} />
      <form onSubmit={submit} noValidate className="relative flex h-full w-full max-w-2xl flex-col bg-bg shadow-2xl animate-fade-in">
        <div className="flex items-start gap-3 border-b px-5 py-4" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
            <Store className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="bf-title" className="font-display text-lg font-bold text-content">
              {isEdit ? tr('br.form.editTitle', { name: branch!.name }) : tr('br.form.createTitle')}
            </h2>
            <p className="text-xs text-content-muted">{tr('br.form.requiredHint')}</p>
          </div>
          <button type="button" onClick={requestClose} className="btn-ghost h-9 w-9 shrink-0 rounded-lg p-0" aria-label={tr('br.close')}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          {serverError && (
            <div className="rounded-xl border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10 px-4 py-3 text-sm text-danger" role="alert">
              {serverError}
            </div>
          )}

          {/* Identité */}
          <Section icon={Building2} title={tr('br.form.identity')}>
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="shrink-0">
                <span className="label">{tr('br.form.logo')}</span>
                <div className="flex items-center gap-2">
                  <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-xl border bg-surface-2">
                    {form.logoUrl ? <img src={form.logoUrl} alt="" className="h-full w-full object-cover" /> : <Store className="h-6 w-6 text-content-faint" />}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="btn-outline h-8 cursor-pointer rounded-lg px-2.5 text-xs">
                      <ImagePlus className="h-3.5 w-3.5" /> {form.logoUrl ? tr('br.form.logoChange') : tr('br.form.logoAdd')}
                      <input type="file" accept="image/*" className="sr-only" onChange={(e) => onLogo(e.target.files?.[0])} />
                    </label>
                    {form.logoUrl && (
                      <button type="button" className="btn-ghost h-8 rounded-lg px-2.5 text-xs text-danger" onClick={() => set('logoUrl', '')}>
                        <Trash2 className="h-3.5 w-3.5" /> {tr('br.form.logoRemove')}
                      </button>
                    )}
                  </div>
                </div>
                {err('logo')}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <label htmlFor="bf-name" className="label">{tr('br.form.name')} <span className="text-danger">*</span></label>
                  <input
                    id="bf-name"
                    ref={nameRef}
                    className="input"
                    value={form.name}
                    maxLength={120}
                    onChange={(e) => set('name', e.target.value)}
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? 'bf-name-err' : undefined}
                    placeholder={tr('br.form.namePh')}
                  />
                  {err('name')}
                </div>
                <div>
                  <label htmlFor="bf-code" className="label">{tr('br.form.code')}</label>
                  <div className="flex gap-2">
                    <input
                      id="bf-code"
                      className="input font-mono uppercase"
                      value={form.code}
                      maxLength={20}
                      onChange={(e) => set('code', e.target.value.toUpperCase())}
                      aria-invalid={Boolean(errors.code)}
                      aria-describedby="bf-code-hint"
                    />
                    {!isEdit && (
                      <button type="button" className="btn-outline h-10 shrink-0 rounded-xl px-3" title={tr('br.form.codeRegen')} onClick={() => codeQuery.refetch().then((r) => r.data && set('code', r.data))}>
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <p id="bf-code-hint" className="mt-1 text-xs text-content-faint">{tr('br.form.codeHint')}</p>
                  {err('code')}
                </div>
              </div>
            </div>
          </Section>

          {/* Coordonnées */}
          <Section icon={Phone} title={tr('br.form.contact')}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="bf-country" className="label">{tr('br.form.country')}</label>
                <select id="bf-country" className="input" value={form.countryCode} onChange={(e) => set('countryCode', e.target.value)}>
                  {SUPPORTED_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="bf-city" className="label">{tr('br.form.city')}</label>
                <input id="bf-city" className="input" value={form.city} maxLength={80} onChange={(e) => set('city', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="bf-address" className="label">{tr('br.form.address')}</label>
                <input id="bf-address" className="input" value={form.address} maxLength={200} onChange={(e) => set('address', e.target.value)} placeholder={tr('br.form.addressPh')} />
              </div>
              <div>
                <label htmlFor="bf-phone" className="label">{tr('br.form.phone')}</label>
                <WhatsappField key={`p-${form.countryCode}`} id="bf-phone" value={form.phone} defaultDial={dial} onChange={(v) => set('phone', v)} />
              </div>
              <div>
                <label htmlFor="bf-wa" className="label">{tr('br.form.whatsapp')}</label>
                <WhatsappField key={`w-${form.countryCode}`} id="bf-wa" value={form.whatsapp} defaultDial={dial} onChange={(v) => set('whatsapp', v)} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="bf-email" className="label">{tr('br.form.email')}</label>
                <input
                  id="bf-email"
                  type="email"
                  className="input"
                  value={form.email}
                  maxLength={160}
                  onChange={(e) => set('email', e.target.value)}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'bf-email-err' : undefined}
                />
                {err('email')}
              </div>
            </div>
          </Section>

          {/* Organisation */}
          <Section icon={Users} title={tr('br.form.organisation')}>
            <div className="space-y-3">
              <div>
                <label htmlFor="bf-manager" className="label">{tr('br.form.manager')}</label>
                <select id="bf-manager" className="input" value={form.managerId} onChange={(e) => set('managerId', e.target.value)}>
                  <option value="">{tr('br.form.noManager')}</option>
                  {activeUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName} — {u.role.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-content-faint">{tr('br.form.managerHint')}</p>
              </div>
              {!isEdit && canAssignTeam && (
                <TeamPicker users={activeUsers} value={form.team} onChange={(v) => set('team', v)} managerId={form.managerId} />
              )}
              {isEdit && <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-content-muted">{tr('br.form.teamLater')}</p>}
            </div>
          </Section>

          <Section icon={Clock} title={tr('br.form.hours')}>
            <HoursEditor value={form.openingHours} onChange={(v) => set('openingHours', v)} />
            {err('hours')}
          </Section>

          <div className="flex gap-2 rounded-xl border border-dashed px-4 py-3 text-xs text-content-muted">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{tr('br.form.orgSettings', { currency })}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t px-5 py-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
          <span className="text-xs text-content-faint" aria-live="polite">{dirty ? tr('br.form.unsaved') : ''}</span>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={requestClose}>{tr('br.cancel')}</Button>
            <Button type="submit" loading={mut.isPending} disabled={!dirty && isEdit}>
              {isEdit ? tr('br.save') : tr('br.form.create')}
            </Button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Store; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="card p-4">
      <legend className="sr-only">{title}</legend>
      <div className="mb-3 flex items-center gap-2" aria-hidden="true">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold text-content">{title}</h3>
      </div>
      {children}
    </fieldset>
  );
}

/** Choix des collaborateurs affectés (rôles limités) — les rôles « tous magasins » y ont déjà accès. */
export function TeamPicker({ users, value, onChange, managerId }: { users: UserDto[]; value: string[]; onChange: (v: string[]) => void; managerId?: string }) {
  const [q, setQ] = useState('');
  const shown = users.filter((u) => `${u.firstName} ${u.lastName} ${u.role.name}`.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div>
      <span className="label">{tr('br.form.team')}</span>
      <input className="input mb-2" placeholder={tr('br.team.search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={tr('br.team.search')} />
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border p-1.5">
        {shown.length === 0 && <p className="px-2 py-3 text-center text-xs text-content-muted">{tr('br.team.none')}</p>}
        {shown.map((u) => {
          const all = Boolean(u.role.allBranches);
          const isMgr = managerId === u.id;
          return (
            <label key={u.id} className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2 ${all ? 'opacity-70' : ''}`}>
              <input
                type="checkbox"
                className="h-4 w-4 accent-[color:var(--primary)]"
                checked={all || isMgr || value.includes(u.id)}
                disabled={all || isMgr}
                onChange={() => toggle(u.id)}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-content">{u.firstName} {u.lastName}</span>
                <span className="block truncate text-xs text-content-muted">
                  {u.role.name}
                  {all ? ` · ${tr('br.team.allAccess')}` : isMgr ? ` · ${tr('br.team.isManager')}` : ''}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

const DAY_LABEL: Record<WeekDay, string> = { mon: 'br.day.mon', tue: 'br.day.tue', wed: 'br.day.wed', thu: 'br.day.thu', fri: 'br.day.fri', sat: 'br.day.sat', sun: 'br.day.sun' };

function HoursEditor({ value, onChange }: { value: OpeningHours | null; onChange: (v: OpeningHours | null) => void }) {
  if (!value) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-content-muted">{tr('br.form.hoursNone')}</p>
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange(Object.fromEntries(WEEK_DAYS.map((d) => [d, d === 'sun' ? null : { ...EMPTY_DAY }])) as OpeningHours)}
        >
          <Clock className="h-4 w-4" /> {tr('br.form.hoursAdd')}
        </Button>
      </div>
    );
  }
  const setDay = (d: WeekDay, v: { open: string; close: string } | null) => onChange({ ...value, [d]: v });
  return (
    <div className="space-y-1.5">
      {WEEK_DAYS.map((d) => {
        const day = value[d] ?? null;
        return (
          <div key={d} className="flex flex-wrap items-center gap-2">
            <label className="flex w-32 items-center gap-2 text-sm text-content">
              <input type="checkbox" className="h-4 w-4 accent-[color:var(--primary)]" checked={Boolean(day)} onChange={(e) => setDay(d, e.target.checked ? { ...EMPTY_DAY } : null)} />
              {tr(DAY_LABEL[d])}
            </label>
            {day ? (
              <>
                <input type="time" className="input h-9 w-28" value={day.open} onChange={(e) => setDay(d, { ...day, open: e.target.value })} aria-label={`${tr(DAY_LABEL[d])} — ${tr('br.form.opens')}`} />
                <span className="text-content-faint">–</span>
                <input type="time" className="input h-9 w-28" value={day.close} onChange={(e) => setDay(d, { ...day, close: e.target.value })} aria-label={`${tr(DAY_LABEL[d])} — ${tr('br.form.closes')}`} />
              </>
            ) : (
              <span className="text-sm text-content-faint">{tr('br.form.closed')}</span>
            )}
          </div>
        );
      })}
      <button type="button" className="mt-1 text-xs font-semibold text-danger hover:underline" onClick={() => onChange(null)}>
        {tr('br.form.hoursClear')}
      </button>
    </div>
  );
}
