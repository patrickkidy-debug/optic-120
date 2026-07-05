import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, Unlock, Wallet, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  getCurrentRegister,
  openRegister,
  closeRegister,
  type CashRegister,
} from '../../features/cashregister/api';
import { useUIStore } from '../../store/ui';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { formatCurrency, formatDateTime } from '../../lib/format';
import { PageHeader, PageLoader, Button, Field, Badge } from '../../components/ui';

export function CashRegisterPage() {
  const qc = useQueryClient();
  const branchId = useUIStore((s) => s.activeBranchId);
  const canOpen = usePermission('optique.cashregister.open');
  const canClose = usePermission('optique.cashregister.close');

  const [opening, setOpening] = useState('');
  const [closing, setClosing] = useState('');
  const [closeResult, setCloseResult] = useState<{ expected: number; counted: number } | null>(null);

  const { data: register, isLoading } = useQuery({
    queryKey: ['cash-current', branchId],
    queryFn: () => getCurrentRegister(branchId!),
    enabled: Boolean(branchId),
  });

  const openMut = useMutation({
    mutationFn: () => openRegister(branchId!, Math.max(0, Math.round(Number(opening) || 0))),
    onSuccess: () => {
      setOpening('');
      qc.invalidateQueries({ queryKey: ['cash-current'] });
    },
    onError: (e) => alert(apiErrorMessage(e)),
  });

  const closeMut = useMutation({
    mutationFn: (reg: CashRegister) =>
      closeRegister(reg.id, Math.max(0, Math.round(Number(closing) || 0))),
    onSuccess: (res) => {
      setCloseResult({ expected: res.expectedAmount, counted: Number(res.register.closingAmount ?? 0) });
      setClosing('');
      qc.invalidateQueries({ queryKey: ['cash-current'] });
    },
    onError: (e) => alert(apiErrorMessage(e)),
  });

  if (!branchId) return <PageLoader />;

  return (
    <div>
      <PageHeader title="Session de caisse" subtitle="Ouverture, fermeture et contrôle d'écart (Z)" />

      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="mx-auto max-w-lg space-y-4">
          {/* Résultat de la dernière fermeture */}
          {closeResult && (
            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <h3 className="font-display font-bold text-content">Caisse fermée</h3>
              </div>
              <SummaryRow label="Attendu (fond + espèces)" value={formatCurrency(closeResult.expected)} />
              <SummaryRow label="Compté" value={formatCurrency(closeResult.counted)} />
              <div className="my-2 border-t" />
              {(() => {
                const diff = closeResult.counted - closeResult.expected;
                const tone = diff === 0 ? 'text-success' : 'text-danger';
                return (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-sm text-content-muted">
                      {diff !== 0 && <AlertTriangle className="h-4 w-4 text-danger" />}
                      Écart
                    </span>
                    <span className={`font-display text-lg font-bold ${tone}`}>
                      {diff > 0 ? '+' : ''}
                      {formatCurrency(diff)}
                    </span>
                  </div>
                );
              })()}
            </div>
          )}

          {register ? (
            /* Caisse ouverte → fermeture */
            <div className="card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  <h3 className="font-display font-bold text-content">Caisse ouverte</h3>
                </div>
                <Badge tone="success">OUVERTE</Badge>
              </div>
              <SummaryRow label="Ouverte le" value={formatDateTime(register.openedAt)} />
              <SummaryRow label="Fond de caisse" value={formatCurrency(Number(register.openingAmount))} />

              {canClose ? (
                <div className="mt-4 border-t pt-4">
                  <Field label="Montant compté en caisse (espèces)">
                    <input
                      type="number"
                      min={0}
                      className="input text-right font-semibold"
                      placeholder="0"
                      value={closing}
                      onChange={(e) => setClosing(e.target.value)}
                    />
                  </Field>
                  <Button
                    className="mt-3 w-full"
                    loading={closeMut.isPending}
                    disabled={closing === ''}
                    onClick={() => closeMut.mutate(register)}
                  >
                    <Lock className="h-4 w-4" /> Fermer la caisse
                  </Button>
                  <p className="mt-2 text-xs text-content-faint">
                    L'écart est calculé par rapport au fond de caisse + les ventes espèces depuis l'ouverture.
                  </p>
                </div>
              ) : (
                <p className="mt-4 border-t pt-4 text-sm text-content-muted">
                  Vous n'avez pas la permission de fermer la caisse.
                </p>
              )}
            </div>
          ) : (
            /* Aucune caisse ouverte → ouverture */
            <div className="card p-5">
              <div className="mb-4 flex items-center gap-2">
                <Unlock className="h-5 w-5 text-primary" />
                <h3 className="font-display font-bold text-content">Aucune caisse ouverte</h3>
              </div>
              {canOpen ? (
                <>
                  <Field label="Fond de caisse à l'ouverture">
                    <input
                      type="number"
                      min={0}
                      className="input text-right font-semibold"
                      placeholder="0"
                      value={opening}
                      onChange={(e) => setOpening(e.target.value)}
                    />
                  </Field>
                  <Button
                    className="mt-3 w-full"
                    loading={openMut.isPending}
                    disabled={opening === ''}
                    onClick={() => openMut.mutate()}
                  >
                    <Unlock className="h-4 w-4" /> Ouvrir la caisse
                  </Button>
                </>
              ) : (
                <p className="text-sm text-content-muted">
                  Vous n'avez pas la permission d'ouvrir la caisse.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-content-muted">{label}</span>
      <span className="font-medium text-content">{value}</span>
    </div>
  );
}
