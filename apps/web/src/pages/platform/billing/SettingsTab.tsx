import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, RotateCcw, Save } from 'lucide-react';
import {
  DEFAULT_INVOICE_TEMPLATES,
  INVOICE_TEMPLATE_VARS,
  type InvoiceMessageKind,
} from '@oculo/shared-types';
import { Button, Field, PageLoader } from '../../../components/ui';
import { apiErrorMessage } from '../../../lib/api';
import {
  getBillingSettings,
  saveBillingSettings,
  type BillingSettings,
} from '../../../features/billing/invoicing';

type Draft = Record<string, string | boolean | number>;

const TEXT_FIELDS: { key: keyof BillingSettings; label: string; placeholder?: string; area?: boolean }[] = [
  { key: 'legalName', label: "Nom légal de l'entreprise" },
  { key: 'tradeName', label: 'Nom commercial' },
  { key: 'address', label: 'Adresse' },
  { key: 'city', label: 'Ville' },
  { key: 'country', label: 'Pays' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'email', label: 'E-mail' },
  { key: 'website', label: 'Site web', placeholder: 'https://oculosaas.com' },
  { key: 'taxId', label: "Numéro d'identification fiscale" },
  { key: 'registrationNumber', label: "Numéro d'enregistrement de l'entreprise" },
  { key: 'defaultCurrency', label: 'Devise par défaut', placeholder: 'XOF' },
  { key: 'whatsappNumber', label: 'Numéro WhatsApp de l’éditeur' },
  { key: 'logoUrl', label: 'Logo (URL)', placeholder: 'https://…' },
  { key: 'paymentTerms', label: 'Conditions de paiement', area: true },
  { key: 'paymentDetails', label: 'Coordonnées de paiement', area: true },
  { key: 'footerNote', label: 'Message de pied de facture', area: true },
];

const TOGGLES: { key: keyof BillingSettings; label: string; hint: string }[] = [
  {
    key: 'autoSendOnPayment',
    label: 'Proposer l’envoi de la facture après chaque paiement réussi',
    hint: 'La facture réglée apparaît en tête de la liste des envois à faire.',
  },
  {
    key: 'remindBeforeDue',
    label: 'Relancer avant échéance',
    hint: 'Les factures concernées apparaissent dans l’onglet Relances.',
  },
  { key: 'remindAfterDue', label: 'Relancer après échéance', hint: 'Idem pour les factures en retard.' },
  {
    key: 'sendPaymentConfirmation',
    label: 'Proposer une confirmation de paiement',
    hint: 'Un message de confirmation est préparé après chaque règlement.',
  },
];

const TEMPLATES: { key: keyof BillingSettings; kind: InvoiceMessageKind; label: string }[] = [
  { key: 'invoiceWhatsappTemplate', kind: 'invoice', label: 'Envoi de facture' },
  { key: 'reminderBeforeTemplate', kind: 'before', label: 'Relance avant échéance' },
  { key: 'reminderDueTemplate', kind: 'due', label: "Relance le jour de l'échéance" },
  { key: 'reminderAfterTemplate', kind: 'after', label: 'Relance après échéance' },
];

/**
 * Paramètres de facturation (§2, §17, §18).
 *
 * Ces champs sont imprimés tels quels sur les factures. Aucun n'est prérempli
 * avec une valeur plausible : une adresse ou un numéro fiscal inventé sur une
 * pièce comptable est pire que son absence.
 *
 * Les bascules d'envoi n'envoient RIEN toutes seules : elles alimentent les
 * listes d'envois à faire. Un envoi automatique silencieux sur un mauvais
 * numéro ne se rattrape pas.
 */
export function BillingSettingsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['platform-billing-settings'],
    queryFn: getBillingSettings,
  });

  const [draft, setDraft] = useState<Draft>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!data) return;
    const next: Draft = {};
    for (const [k, v] of Object.entries(data)) {
      if (k === 'id') continue;
      next[k] = v ?? '';
    }
    setDraft(next);
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => saveBillingSettings(draft as never),
    onSuccess: () => {
      setSaved(true);
      setError('');
      void qc.invalidateQueries({ queryKey: ['platform-billing-settings'] });
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  if (isLoading || !data) return <PageLoader />;

  const set = (key: string, value: string | boolean | number) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-5">
      <section className="card p-4">
        <h3 className="mb-1 font-display text-base font-bold text-content">
          Coordonnées imprimées sur les factures
        </h3>
        <p className="mb-4 text-xs text-content-faint">
          Un champ laissé vide n’apparaît pas sur la facture. Rien n’est inventé.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TEXT_FIELDS.map((f) => (
            <div key={String(f.key)} className={f.area ? 'sm:col-span-2' : ''}>
              <Field label={f.label}>
                {f.area ? (
                  <textarea
                    className="input min-h-[70px]"
                    placeholder={f.placeholder}
                    value={String(draft[f.key] ?? '')}
                    onChange={(e) => set(String(f.key), e.target.value)}
                  />
                ) : (
                  <input
                    className="input"
                    placeholder={f.placeholder}
                    value={String(draft[f.key] ?? '')}
                    onChange={(e) => set(String(f.key), e.target.value)}
                  />
                )}
              </Field>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-4">
        <h3 className="mb-1 font-display text-base font-bold text-content">Envois et relances</h3>
        <p className="mb-4 text-xs text-content-faint">
          Ces options préparent les messages et alimentent la liste des relances. Chaque envoi reste
          déclenché par vous, après relecture.
        </p>
        <div className="space-y-3">
          {TOGGLES.map((t) => (
            <label key={String(t.key)} className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded"
                checked={Boolean(draft[t.key])}
                onChange={(e) => set(String(t.key), e.target.checked)}
              />
              <span>
                <span className="block text-sm font-medium text-content">{t.label}</span>
                <span className="block text-xs text-content-faint">{t.hint}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="mt-4 max-w-[220px]">
          <Field label="Jours avant échéance pour la relance">
            <input
              className="input"
              inputMode="numeric"
              value={String(draft.remindBeforeDays ?? 3)}
              onChange={(e) => set('remindBeforeDays', Number(e.target.value) || 3)}
            />
          </Field>
        </div>
      </section>

      <section className="card p-4">
        <h3 className="mb-1 font-display text-base font-bold text-content">Messages WhatsApp</h3>
        <p className="mb-3 text-xs text-content-faint">
          Variables disponibles :{' '}
          {INVOICE_TEMPLATE_VARS.map((v) => `{${v}}`).join(', ')}. Laisser vide pour utiliser le
          message par défaut.
        </p>
        <div className="space-y-4">
          {TEMPLATES.map((t) => (
            <div key={String(t.key)}>
              <div className="mb-1 flex items-center justify-between">
                <span className="label mb-0">{t.label}</span>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => set(String(t.key), DEFAULT_INVOICE_TEMPLATES[t.kind])}
                >
                  <RotateCcw className="mr-1 inline h-3 w-3" />
                  Remettre le modèle par défaut
                </button>
              </div>
              <textarea
                className="input min-h-[130px] font-mono text-xs leading-relaxed"
                placeholder={DEFAULT_INVOICE_TEMPLATES[t.kind]}
                value={String(draft[t.key] ?? '')}
                onChange={(e) => set(String(t.key), e.target.value)}
              />
            </div>
          ))}
        </div>
      </section>

      {error && (
        <p className="rounded-lg bg-[color:var(--danger)]/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="flex items-center gap-1 text-sm text-success">
            <Check className="h-4 w-4" /> Enregistré
          </span>
        )}
        <Button loading={mutation.isPending} onClick={() => mutation.mutate()}>
          <Save className="h-4 w-4" /> Enregistrer les paramètres
        </Button>
      </div>
    </div>
  );
}
