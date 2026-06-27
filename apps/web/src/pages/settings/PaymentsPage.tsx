import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Smartphone, CheckCircle2, FlaskConical } from 'lucide-react';
import type { PaymentConfigInput } from '@oculo/shared-types';
import { getPaymentConfig, savePaymentConfig } from '../../features/settings/api';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { PageHeader, Button, Field, Badge, PageLoader } from '../../components/ui';

const PROVIDERS = ['Orange Money', 'Wave', 'MTN MoMo', 'Moov Money', 'Free Money', 'Visa', 'Mastercard'];

export function PaymentsPage() {
  const qc = useQueryClient();
  const canUpdate = usePermission('settings.payments.update');
  const { data: config, isLoading } = useQuery({ queryKey: ['payment-config'], queryFn: getPaymentConfig });

  const [form, setForm] = useState<PaymentConfigInput>({
    apiKey: '',
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
        apiKey: '',
        siteId: config.siteId,
        environment: config.environment,
        webhookUrl: config.webhookUrl,
        simulationMode: config.simulationMode,
      });
    }
  }, [config]);

  const mut = useMutation({
    mutationFn: () => savePaymentConfig(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-config'] });
      setSaved(true);
      setForm((f) => ({ ...f, apiKey: '' }));
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  if (isLoading || !config) return <PageLoader />;

  return (
    <div>
      <PageHeader title="Paiements — CinetPay" subtitle="Mobile Money & cartes pour l'Afrique de l'Ouest" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent">
              <CreditCard className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display font-bold text-content">Configuration CinetPay</h3>
              <p className="text-xs text-content-muted">
                {config.simulationMode ? 'Mode simulation actif' : 'Mode production'}
              </p>
            </div>
            {config.apiKeySet && <Badge tone="success">Clé configurée</Badge>}
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
                onClick={() => canUpdate && setForm((f) => ({ ...f, simulationMode: !f.simulationMode }))}
                disabled={!canUpdate}
                className={`relative h-6 w-11 rounded-full transition ${form.simulationMode ? 'bg-primary' : 'bg-surface-3'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${form.simulationMode ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>

            <Field label="API Key">
              <input
                className="input"
                type="password"
                placeholder={config.apiKeySet ? '•••••••• (laisser vide pour conserver)' : 'Votre clé API CinetPay'}
                value={form.apiKey}
                disabled={!canUpdate}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Site ID">
                <input
                  className="input"
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
                  <option value="sandbox">Sandbox</option>
                  <option value="production">Production</option>
                </select>
              </Field>
            </div>
            <Field label="URL de webhook (notify_url)">
              <input
                className="input"
                placeholder="https://votre-domaine/webhooks/cinetpay"
                value={form.webhookUrl}
                disabled={!canUpdate}
                onChange={(e) => setForm((f) => ({ ...f, webhookUrl: e.target.value }))}
              />
            </Field>

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
          <div className="space-y-2">
            {PROVIDERS.map((p) => (
              <div key={p} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
                <span className="text-content">{p}</span>
                <CheckCircle2 className="h-4 w-4 text-success" />
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-content-faint">
            Devises : XOF (FCFA) · XAF. En mode simulation, les paiements mobiles se confirment manuellement.
          </p>
        </div>
      </div>
    </div>
  );
}
