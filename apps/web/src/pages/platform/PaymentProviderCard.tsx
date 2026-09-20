import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Check, Copy, CreditCard } from 'lucide-react';
import { getPaymentProviderStatus } from '../../features/billing/api';
import { Badge } from '../../components/ui';

const LABELS: Record<string, string> = {
  moneroo: 'Moneroo',
  simulation: 'Simulation',
};

/**
 * État de la passerelle d'encaissement des abonnements.
 *
 * Moneroo est la seule passerelle retenue pour les abonnements. Sans cet écran,
 * poser une clé revient à configurer à l'aveugle : rien n'indiquait si la
 * passerelle était réellement active, ni si l'adresse de notification était
 * joignable. Aucun secret n'est affiché.
 */
export function PaymentProviderCard() {
  const [copied, setCopied] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['platform-payment-provider'],
    queryFn: getPaymentProviderStatus,
  });

  if (isLoading || !data) return null;

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      /* Presse-papiers refusé : l'URL reste sélectionnable à la main. */
    }
  };

  const missingWebhookUrl = data.active !== 'simulation' && !data.subscriptionWebhookUrl;

  return (
    <div className="card mb-4 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display font-bold text-content">
          <CreditCard className="h-4 w-4 text-primary" aria-hidden="true" />
          Encaissement des abonnements
        </h3>
        <Badge tone={data.simulation ? 'danger' : 'success'}>
          {LABELS[data.active] ?? data.active}
        </Badge>
      </div>

      {data.simulation ? (
        <p className="rounded-lg bg-[color:var(--danger)]/10 px-3 py-2 text-sm text-danger">
          Aucune passerelle réelle configurée : les paiements sont simulés. En production, l'API refuse
          de démarrer dans cet état — un abonnement ne doit jamais s'activer sans paiement réel.
        </p>
      ) : (
        <p className="text-sm text-content-muted">
          Les abonnements sont encaissés par <strong>Moneroo</strong>, seule passerelle retenue. Sans
          clé Moneroo, l'API refuse de démarrer en production : aucun abonnement ne peut s'activer
          sans paiement réel.
        </p>
      )}

      {data.monerooConfigured && (
        <div className="mt-3 rounded-xl border p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-muted">
            Adresses à déclarer chez Moneroo
          </p>

          {missingWebhookUrl ? (
            <p className="rounded-lg bg-[color:var(--warning)]/10 px-3 py-2 text-sm text-warning">
              <AlertTriangle className="mr-1 inline h-4 w-4" aria-hidden="true" />
              PUBLIC_API_URL n'est pas défini sur l'API. Moneroo n'a donc aucune adresse où notifier un
              paiement : les abonnements resteraient « en attente » malgré un règlement réussi.
            </p>
          ) : (
            <div className="space-y-2">
              <WebhookRow
                label="Abonnements"
                url={data.subscriptionWebhookUrl}
                copied={copied}
                onCopy={copy}
              />
              <WebhookRow
                label="Ventes des magasins"
                url={data.salesWebhookUrl}
                copied={copied}
                onCopy={copy}
              />
            </div>
          )}

          <p className="mt-2 text-xs text-content-faint">
            Signature du webhook :{' '}
            {data.monerooWebhookSecret ? (
              <span className="text-success">secret renseigné</span>
            ) : (
              <span className="text-warning">
                absente. Le statut est de toute façon revérifié auprès de Moneroo avant toute
                activation, donc un appel falsifié ne peut rien débloquer.
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function WebhookRow({
  label,
  url,
  copied,
  onCopy,
}: {
  label: string;
  url: string;
  copied: string;
  onCopy: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-content-muted">{label}</p>
        <p className="truncate font-mono text-xs text-content">{url}</p>
      </div>
      <button
        type="button"
        onClick={() => onCopy(url)}
        className="btn-ghost h-8 shrink-0 rounded-lg px-2 text-xs"
        aria-label={`Copier l'adresse ${label}`}
      >
        {copied === url ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}
