import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { BadgeCheck, Check, Clock, Copy } from 'lucide-react';
import { Button, Field, Modal } from '../../../components/ui';
import { apiErrorMessage } from '../../../lib/api';
import { formatCurrency } from '../../../lib/format';
import {
  extendTrial,
  getPlatformPlans,
  platformActivate,
  type PlatformUser,
} from '../../../features/billing/api';

/**
 * Modales d'abonnement partagees par la console.
 *
 * Extraites de PlatformPage : la page est devenue la coquille de navigation, et
 * les ecrans qu'elle rend ont besoin de ces modales. Les laisser dans le meme
 * fichier aurait cree un import circulaire entre la coquille et ses pages.
 * Le contenu est repris tel quel, sans changement de comportement.
 */

export function ExtendTrialModal({
  sub,
  onClose,
  onDone,
}: {
  sub: { tenantId: string; tenantName: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState('24');
  const [unit, setUnit] = useState<'hours' | 'days'>('hours');
  const [error, setError] = useState('');

  const minutes = Math.max(1, Number(amount) || 0) * (unit === 'days' ? 24 * 60 : 60);

  const mut = useMutation({
    mutationFn: () => extendTrial(sub.tenantId, minutes),
    onSuccess: onDone,
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title={`Prolonger l'essai — ${sub.tenantName}`} size="sm">
      <div className="space-y-3">
        <p className="text-sm text-content-muted">
          Reconduit l'essai gratuit (accès complet, sans paiement), à partir de l'échéance actuelle si
          elle n'est pas encore passée, sinon de maintenant.
        </p>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="Durée">
              <input
                type="number"
                min={1}
                className="input text-right"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
          </div>
          <select
            className="input h-[42px] w-28"
            value={unit}
            onChange={(e) => setUnit(e.target.value as 'hours' | 'days')}
          >
            <option value="hours">heures</option>
            <option value="days">jours</option>
          </select>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button loading={mut.isPending} onClick={() => mut.mutate()}>
            <Clock className="h-4 w-4" /> Reconduire
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Activation manuelle d'un abonnement (paiement reçu en direct) : durée ET
 * offre au choix — un client peut régler une offre différente de la sienne.
 */
export function ActivateSubscriptionModal({
  sub,
  onClose,
  onDone,
}: {
  sub: { tenantId: string; tenantName: string; planCode: string | null };
  onClose: () => void;
  onDone: () => void;
}) {
  const { data: plans } = useQuery({ queryKey: ['platform-plans'], queryFn: getPlatformPlans });
  const [planCode, setPlanCode] = useState(sub.planCode ?? '');
  const [months, setMonths] = useState('1');
  const [error, setError] = useState('');

  const chosen = plans?.find((p) => p.code === planCode);
  const nb = Math.max(1, Number(months) || 1);
  const total = chosen ? Number(chosen.priceMonthly) * nb : 0;

  const mut = useMutation({
    mutationFn: () => platformActivate(sub.tenantId, nb, planCode),
    onSuccess: onDone,
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title={`Activer — ${sub.tenantName}`} size="sm">
      <div className="space-y-3">
        <p className="text-sm text-content-muted">
          Paiement reçu en direct : choisissez l'offre réglée par le client et la durée à créditer.
        </p>
        <Field label="Offre payée">
          <select className="input" value={planCode} onChange={(e) => setPlanCode(e.target.value)}>
            {plans?.map((p) => (
              <option key={p.id} value={p.code}>
                {p.name} — {formatCurrency(Number(p.priceMonthly))} / mois
              </option>
            ))}
          </select>
        </Field>
        <Field label="Durée (mois)">
          <input
            type="number"
            min={1}
            className="input text-right"
            value={months}
            onChange={(e) => setMonths(e.target.value)}
          />
        </Field>
        {chosen && (
          <div className="flex justify-between rounded-xl bg-surface-2 px-3 py-2 text-sm">
            <span className="text-content-muted">Montant correspondant</span>
            <span className="font-display font-bold text-content">{formatCurrency(total)}</span>
          </div>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button loading={mut.isPending} onClick={() => mut.mutate()}>
            <BadgeCheck className="h-4 w-4" /> Activer {nb} mois
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function PlatformResetPasswordModal({
  user,
  tempPassword,
  onClose,
}: {
  user: PlatformUser;
  tempPassword: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papier indisponible : copie manuelle.
    }
  }

  return (
    <Modal open onClose={onClose} title="Mot de passe temporaire" size="sm">
      <p className="text-sm text-content-muted">
        Nouveau mot de passe pour <b className="text-content">{user.name}</b> ({user.email}) —{' '}
        {user.tenantName}. Transmettez-le vous-même (WhatsApp, SMS…) — il ne sera plus affiché après
        fermeture de cette fenêtre.
      </p>
      <div className="mt-4 flex items-center gap-2 rounded-xl border bg-surface-2 p-3">
        <span className="flex-1 select-all font-mono text-lg font-bold tracking-wider text-content">{tempPassword}</span>
        <button onClick={copy} className="btn-ghost h-9 w-9 rounded-lg p-0" title="Copier">
          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <p className="mt-3 text-xs text-content-faint">
        Ses sessions actives ont été déconnectées ; il devra se reconnecter avec ce mot de passe.
      </p>
      <Button className="mt-5 w-full" onClick={onClose}>
        J'ai noté le mot de passe
      </Button>
    </Modal>
  );
}
