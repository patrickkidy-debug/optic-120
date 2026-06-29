import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Smartphone, CheckCircle2, FlaskConical } from 'lucide-react';
import type { PaymentConfigInput } from '@oculo/shared-types';
import { getPaymentConfig, savePaymentConfig } from '../../features/settings/api';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { PageHeader, Button, Field, Badge, PageLoader } from '../../components/ui';
import { PaymentMethodLogos } from '../../components/PaymentMethodLogos';

export function PaymentsPage() {
  const qc = useQueryClient();
  const canUpdate = usePermission('settings.payments.update');
  const { data: config, isLoading } = useQuery({ queryKey: ['payment-config'], queryFn: getPaymentConfig });

  const [form, setForm] = useState<PaymentConfigInput>({
    provider: 'paytech',
    apiKey: '',
    apiSecret: '',
    siteId: '',
    environment: 'sandbox',
    webhookUrl: '',
    simulationMode: true,
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (config) {
      setForm({
        provider: config.provider ?? 'paytech',
        apiKey: '',
        apiSecret: '',
        siteId: config.siteId || '',
        environment: config.environment || 'sandbox',
        webhookUrl: config.webhookUrl || '',
        simulationMode: config.simulationMode ?? true,
      });
    }
  }, [config]);

  const mut = useMutation({
    mutationFn: () => savePaymentConfig(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-config'] });
      setSaved(true);
      setForm((f) => ({ ...f, apiKey: '', apiSecret: '' }));
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  if (isLoading || !config) return <PageLoader />;

  return (
    <div>
      <PageHeader title="Passerelle de Paiement" subtitle="Encaissez vos ventes via Wave, Orange Money, Togocel (T-Money), MTN et cartes bancaires" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent">
              {form.provider === 'moneroo' ? (
                <Smartphone className="h-5 w-5" />
              ) : (
                <CreditCard className="h-5 w-5" />
              )}
            </span>
            <div>
              <h3 className="font-display font-bold text-content">
                Configuration {form.provider === 'moneroo' ? 'Moneroo' : 'PayTech'}
              </h3>
              <p className="text-xs text-content-muted">
                {form.simulationMode ? 'Mode simulation actif' : 'Mode production'}
              </p>
            </div>
            {config.apiKeySet && config.provider === form.provider && (
              <Badge tone="success">Clé configurée</Badge>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-surface-2 p-3">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium text-content">Mode simulation</p>
                  <p className="text-xs text-content-muted">Tester les paiements sans clé réelle</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => canUpdate && setForm((f) => ({ ...f, simulationMode: !f.simulationMode }))}
                disabled={!canUpdate}
                className={`relative h-6 w-11 rounded-full transition ${form.simulationMode ? 'bg-primary' : 'bg-surface-3'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${form.simulationMode ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>

            <div className="mb-6">
              <label className="text-sm font-semibold text-content mb-2 block">
                Fournisseur de paiement
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  disabled={!canUpdate}
                  onClick={() => setForm((f) => ({ ...f, provider: 'paytech' }))}
                  className={`flex items-start gap-3 p-4 rounded-xl border text-left transition ${
                    form.provider === 'paytech'
                      ? 'border-primary bg-primary-soft/10 ring-1 ring-primary'
                      : 'border-surface-3 bg-surface hover:border-surface-4'
                  }`}
                >
                  <span className={`grid h-8 w-8 place-items-center rounded-lg ${
                    form.provider === 'paytech' ? 'bg-primary text-white' : 'bg-surface-3 text-content-muted'
                  }`}>
                    <CreditCard className="h-4 w-4" />
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-content">PayTech (Sénégal)</h4>
                    <p className="text-xs text-content-muted mt-0.5">
                      Idéal pour Wave, Orange Money, Free Money & Cartes (Sénégal).
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={!canUpdate}
                  onClick={() => setForm((f) => ({ ...f, provider: 'moneroo' }))}
                  className={`flex items-start gap-3 p-4 rounded-xl border text-left transition ${
                    form.provider === 'moneroo'
                      ? 'border-primary bg-primary-soft/10 ring-1 ring-primary'
                      : 'border-surface-3 bg-surface hover:border-surface-4'
                  }`}
                >
                  <span className={`grid h-8 w-8 place-items-center rounded-lg ${
                    form.provider === 'moneroo' ? 'bg-primary text-white' : 'bg-surface-3 text-content-muted'
                  }`}>
                    <Smartphone className="h-4 w-4" />
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-content">Moneroo (Multi-pays)</h4>
                    <p className="text-xs text-content-muted mt-0.5">
                      Supporte Togocel (T-Money), Wave, MTN, Orange Money, Moov.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {form.provider === 'paytech' ? (
              <>
                <Field label="Clé API PayTech">
                  <input
                    className="input"
                    type="password"
                    placeholder={config.provider === 'paytech' && config.apiKeySet ? '•••••••• (laisser vide pour conserver)' : 'Votre clé API PayTech'}
                    value={form.apiKey}
                    disabled={!canUpdate}
                    onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                  />
                </Field>
                <Field label="Clé secrète PayTech">
                  <input
                    className="input"
                    type="password"
                    placeholder={config.provider === 'paytech' && config.apiSecretSet ? '•••••••• (laisser vide pour conserver)' : 'Votre clé secrète PayTech'}
                    value={form.apiSecret}
                    disabled={!canUpdate}
                    onChange={(e) => setForm((f) => ({ ...f, apiSecret: e.target.value }))}
                  />
                </Field>
                <Field label="Identifiant Site PayTech (site_id)">
                  <input
                    className="input"
                    type="text"
                    placeholder="Votre Identifiant Site PayTech"
                    value={form.siteId}
                    disabled={!canUpdate}
                    onChange={(e) => setForm((f) => ({ ...f, siteId: e.target.value }))}
                  />
                </Field>
                <Field label="Environnement">
                  <select
                    className="input"
                    value={form.environment}
                    disabled={!canUpdate}
                    onChange={(e) => setForm((f) => ({ ...f, environment: e.target.value as 'sandbox' | 'production' }))}
                  >
                    <option value="sandbox">Test</option>
                    <option value="production">Production</option>
                  </select>
                </Field>
                <p className="text-xs text-content-faint">
                  URL IPN à configurer dans PayTech :
                  <br />
                  <code className="select-all text-content">https://api.oculosaas.com/webhooks/paytech</code>
                </p>
              </>
            ) : (
              <>
                <Field label="Clé secrète Moneroo (Secret Key)">
                  <input
                    className="input"
                    type="password"
                    placeholder={config.provider === 'moneroo' && config.apiKeySet ? '•••••••• (laisser vide pour conserver)' : 'Votre clé secrète Moneroo (débute par moneroo_)'}
                    value={form.apiKey}
                    disabled={!canUpdate}
                    onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                  />
                </Field>
                <Field label="Secret de signature Webhook Moneroo (optionnel)">
                  <input
                    className="input"
                    type="password"
                    placeholder={config.provider === 'moneroo' && config.apiSecretSet ? '•••••••• (laisser vide pour conserver)' : 'Secret webhook pour valider les signatures de notification'}
                    value={form.apiSecret}
                    disabled={!canUpdate}
                    onChange={(e) => setForm((f) => ({ ...f, apiSecret: e.target.value }))}
                  />
                </Field>
                <p className="text-xs text-content-faint">
                  Dans votre dashboard Moneroo → Webhooks, renseignez :
                  <br />
                  <code className="select-all text-content">https://api.oculosaas.com/webhooks/moneroo</code>
                  <br />
                  Pensez aussi à activer une méthode pour la devise XOF.
                </p>
              </>
            )}

            {error && <p className="text-sm text-danger">{error}</p>}
            {canUpdate && (
              <div className="flex items-center gap-3">
                <Button onClick={() => mut.mutate()} loading={mut.isPending}>
                  Enregistrer
                </Button>
                {saved && (
                  <span className="flex items-center gap-1 text-sm text-success">
                    <CheckCircle2 className="h-4 w-4" /> Enregistré
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            <h3 className="font-display font-bold text-content">Moyens acceptés</h3>
          </div>
          <PaymentMethodLogos />
          <p className="mt-4 text-xs text-content-faint">
            Devises supportées : XOF (FCFA), XAF, GNFs, etc. En mode simulation, les paiements mobiles se confirment manuellement en caisse.
          </p>
        </div>
      </div>
    </div>
  );
}
