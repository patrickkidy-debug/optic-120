import { useRef, useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  TrendingDown,
  Landmark,
  Ban,
  Paperclip,
  FileImage,
  ArrowRightLeft,
  Pencil,
  ScrollText,
} from 'lucide-react';
import type { CashTransferCreateInput, ExpenseCreateInput, BankAccountCreateInput } from '@oculo/shared-types';
import {
  listCashTransfers,
  createCashTransfer,
  cancelCashTransfer,
  listExpenses,
  createExpense,
  cancelExpense,
  listBankAccounts,
  createBankAccount,
  updateBankAccount,
  getBankStatement,
  type BankAccount,
  type CashTransfer,
  type Expense,
} from '../../features/management/api';
import { listBranches } from '../../features/optique/api';
import { useUIStore } from '../../store/ui';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { invalidateFinancialViews } from '../../lib/queryInvalidation';
import { uploadImageToSupabase } from '../../lib/image';
import { formatCurrency, formatDate, formatDateTime, currencySymbol } from '../../lib/format';
import { PageHeader, Button, Modal, Field, Badge, StatCard, PageLoader, EmptyState } from '../../components/ui';
import { tr } from '../../lib/tr';

const L = (k: string, v?: Record<string, unknown>) => tr(`ui.CashFlowPage.${k}`, v);

const EXPENSE_CATEGORIES = [
  { value: 'RENT', get label() { return L('loyer'); } },
  { value: 'SALARIES', get label() { return L('salaires'); } },
  { value: 'ELECTRICITY', get label() { return L('electricite'); } },
  { value: 'WATER', get label() { return L('eau'); } },
  { value: 'INTERNET', label: 'Internet' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'SUPPLIES', get label() { return L('fournitures'); } },
  { value: 'MAINTENANCE', get label() { return L('entretien'); } },
  { value: 'TAXES', get label() { return L('taxes'); } },
  { value: 'OTHER', get label() { return L('autre'); } },
];
const expenseCatLabel = (v: string) => EXPENSE_CATEGORIES.find((c) => c.value === v)?.label ?? v;

type Kind = CashTransfer['kind'];
/** Types de versement : effet sur la caisse (espèces) et sur le compte bancaire. */
const KINDS: { value: Kind; icon: typeof Wallet; cash: -1 | 0 | 1; bank: -1 | 0 | 1 }[] = [
  { value: 'CASH_IN', icon: ArrowDownCircle, cash: 1, bank: 0 },
  { value: 'CASH_OUT', icon: ArrowUpCircle, cash: -1, bank: 0 },
  { value: 'CASH_TO_BANK', icon: Landmark, cash: -1, bank: 1 },
  { value: 'BANK_TO_CASH', icon: Wallet, cash: 1, bank: -1 },
  { value: 'BANK_IN', icon: ArrowDownCircle, cash: 0, bank: 1 },
  { value: 'BANK_OUT', icon: ArrowUpCircle, cash: 0, bank: -1 },
];
const kindLabel = (k: Kind) => L(`kind_${k}`);
const kindHint = (k: Kind) => L(`kindHint_${k}`);
const METHODS = ['ESPECES', 'VIREMENT', 'CHEQUE', 'MOBILE_MONEY', 'DEPOT'] as const;
const SOURCES = ['CASH', 'BANK', 'MOBILE_MONEY', 'CHEQUE'] as const;

type Tab = 'transfers' | 'expenses' | 'banks';

function monthStartIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

/**
 * Dépenses et versements : charges d'exploitation, mouvements d'argent
 * (caisse ⇄ banque, virements) et comptes bancaires. Rien n'est supprimé :
 * une écriture erronée est annulée avec un motif et reste visible.
 */
export function CashFlowPage() {
  const qc = useQueryClient();
  const branchId = useUIStore((s) => s.activeBranchId);
  const canCreate = usePermission('finance.expenses.create');
  const canCancel = usePermission('finance.expenses.delete');

  const [tab, setTab] = useState<Tab>('transfers');
  const [transferOpen, setTransferOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [bankForm, setBankForm] = useState<BankAccount | 'new' | null>(null);
  const [statementFor, setStatementFor] = useState<BankAccount | null>(null);
  const [cancelling, setCancelling] = useState<{ type: 'transfer' | 'expense'; id: string; label: string } | null>(null);
  const [from, setFrom] = useState(monthStartIso());
  const [to, setTo] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const filters = { from, to, includeCancelled: showCancelled };

  const { data: cash, isLoading: loadingCash } = useQuery({
    queryKey: ['cash-transfers', branchId, filters],
    queryFn: () => listCashTransfers(branchId ?? undefined, filters),
  });
  const { data: expenses, isLoading: loadingExpenses } = useQuery({
    queryKey: ['expenses', branchId, filters],
    queryFn: () => listExpenses(branchId ?? undefined, filters),
  });
  const { data: banks } = useQuery({ queryKey: ['bank-accounts'], queryFn: listBankAccounts });

  const validExpenses = (expenses ?? []).filter((e) => !e.cancelledAt);
  const expensesTotal = validExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const cashExpenses = validExpenses.filter((e) => (e.paymentSource ?? 'CASH') === 'CASH').reduce((s, e) => s + Number(e.amount), 0);
  const cashNet = (cash?.totals.cashIn ?? 0) - (cash?.totals.cashOut ?? 0) - cashExpenses;
  const bankTotal = (banks ?? []).filter((b) => b.active).reduce((s, b) => s + b.balance, 0);

  return (
    <div>
      <PageHeader
        title={L('depensesVersements')}
        subtitle={L('sousTitreDetaille')}
        actions={
          canCreate && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setBankForm('new')}>
                <Landmark className="h-4 w-4" /> {L('compteBancaire')}
              </Button>
              <Button variant="outline" onClick={() => setExpenseOpen(true)}>
                <Plus className="h-4 w-4" /> {L('depense')}
              </Button>
              <Button onClick={() => setTransferOpen(true)}>
                <Plus className="h-4 w-4" /> {L('versement')}
              </Button>
            </div>
          )
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ArrowDownCircle} label={L('entreesCaisse')} value={formatCurrency(cash?.totals.cashIn ?? 0)} tone="success" />
        <StatCard
          icon={ArrowUpCircle}
          label={L('sortiesCaisse')}
          value={formatCurrency((cash?.totals.cashOut ?? 0) + cashExpenses)}
          hint={L('dontDepensesEspeces', { amount: formatCurrency(cashExpenses) })}
          tone="danger"
        />
        <StatCard icon={TrendingDown} label={L('depensesDExploitation')} value={formatCurrency(expensesTotal)} hint={L('tousMoyens')} tone="danger" />
        <StatCard
          icon={Landmark}
          label={L('soldeBanques')}
          value={formatCurrency(bankTotal)}
          hint={L('soldeNetCaisse', { amount: formatCurrency(cashNet) })}
          tone={bankTotal >= 0 ? 'primary' : 'danger'}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-1 border-b">
          {([
            { key: 'transfers' as Tab, label: L('versements') },
            { key: 'expenses' as Tab, label: L('depenses') },
            { key: 'banks' as Tab, label: L('comptesBancaires') },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                tab === t.key ? 'border-primary text-primary' : 'border-transparent text-content-muted hover:text-content'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab !== 'banks' && (
          <div className="ml-auto flex flex-wrap items-end gap-2 text-xs">
            <label className="text-content-muted">
              {L('du')}
              <input type="date" className="input mt-1 py-1.5 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="text-content-muted">
              {L('au')}
              <input type="date" className="input mt-1 py-1.5 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <label className="flex items-center gap-1.5 pb-2 text-sm text-content">
              <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
              {L('afficherAnnules')}
            </label>
          </div>
        )}
      </div>

      {tab === 'transfers' &&
        (loadingCash ? (
          <PageLoader />
        ) : !cash || cash.transfers.length === 0 ? (
          <EmptyState icon={Wallet} title={L('aucunVersementEnregistre')} hint={L('enregistrezLesApportsDArgent')} />
        ) : (
          <div className="space-y-2">
            {cash.transfers.map((t) => {
              const k = KINDS.find((x) => x.value === t.kind) ?? KINDS[0];
              const positive = k.cash > 0 || (k.cash === 0 && k.bank > 0);
              return (
                <Row
                  key={t.id}
                  cancelled={Boolean(t.cancelledAt)}
                  icon={<k.icon className={`h-5 w-5 ${positive ? 'text-success' : 'text-danger'}`} />}
                  title={t.label}
                  badges={
                    <>
                      <Badge tone={positive ? 'success' : 'warning'}>{kindLabel(t.kind)}</Badge>
                      {t.method && <Badge tone="neutral">{L(`method_${t.method}`)}</Badge>}
                    </>
                  }
                  details={[
                    t.bankAccount ? `${t.bankAccount.bankName} · ${t.bankAccount.accountName}` : null,
                    t.reference ? L('refX', { ref: t.reference }) : null,
                    t.counterparty ? L('tiersX', { name: t.counterparty }) : null,
                    t.handledBy ? L('effectueParX', { name: t.handledBy }) : null,
                    t.notes,
                  ]}
                  trace={trace(t)}
                  amount={`${positive ? '+' : '−'} ${formatCurrency(Number(t.amount))}`}
                  amountTone={positive ? 'text-success' : 'text-danger'}
                  date={formatDate(t.date)}
                  attachmentUrl={t.attachmentUrl}
                  onCancel={canCancel && !t.cancelledAt ? () => setCancelling({ type: 'transfer', id: t.id, label: t.label }) : undefined}
                />
              );
            })}
          </div>
        ))}

      {tab === 'expenses' &&
        (loadingExpenses ? (
          <PageLoader />
        ) : !expenses || expenses.length === 0 ? (
          <EmptyState icon={TrendingDown} title={L('aucuneDepenseEnregistree')} />
        ) : (
          <div className="space-y-2">
            {expenses.map((x) => (
              <Row
                key={x.id}
                cancelled={Boolean(x.cancelledAt)}
                icon={<TrendingDown className="h-5 w-5 text-danger" />}
                title={x.label}
                badges={
                  <>
                    <Badge tone="accent">{expenseCatLabel(x.category)}</Badge>
                    <Badge tone={(x.paymentSource ?? 'CASH') === 'CASH' ? 'warning' : 'info'}>{L(`source_${x.paymentSource ?? 'CASH'}`)}</Badge>
                  </>
                }
                details={[
                  x.bankAccount ? `${x.bankAccount.bankName} · ${x.bankAccount.accountName}` : null,
                  x.payee ? L('beneficiaireX', { name: x.payee }) : null,
                  x.reference ? L('refX', { ref: x.reference }) : null,
                  x.notes,
                ]}
                trace={trace(x)}
                amount={`− ${formatCurrency(Number(x.amount))}`}
                amountTone="text-danger"
                date={formatDate(x.date)}
                attachmentUrl={x.attachmentUrl}
                onCancel={canCancel && !x.cancelledAt ? () => setCancelling({ type: 'expense', id: x.id, label: x.label }) : undefined}
              />
            ))}
          </div>
        ))}

      {tab === 'banks' &&
        (!banks || banks.length === 0 ? (
          <EmptyState icon={Landmark} title={L('aucunCompteBancaire')} hint={L('ajoutezVosComptes')} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {banks.map((b) => (
              <div key={b.id} className={`card p-4 ${b.active ? '' : 'opacity-60'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold text-content">
                      <Landmark className="h-4 w-4 text-primary" /> {b.bankName}
                    </p>
                    <p className="truncate text-sm text-content-muted">{b.accountName}</p>
                    {(b.accountNumber || b.iban) && (
                      <p className="mt-0.5 truncate font-mono text-xs text-content-faint">{b.iban || b.accountNumber}</p>
                    )}
                  </div>
                  {!b.active && <Badge tone="neutral">{L('inactif')}</Badge>}
                </div>
                <p className={`mt-3 font-display text-2xl font-bold ${b.balance >= 0 ? 'text-content' : 'text-danger'}`}>
                  {formatCurrency(b.balance)}
                </p>
                <p className="text-xs text-content-faint">
                  {L('creditsDebits', { credits: formatCurrency(b.credits), debits: formatCurrency(b.debits), n: b.movements })}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" className="h-8 flex-1 px-2 text-xs" onClick={() => setStatementFor(b)}>
                    <ScrollText className="h-3.5 w-3.5" /> {L('releve')}
                  </Button>
                  {canCreate && (
                    <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => setBankForm(b)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}

      {transferOpen && <TransferModal banks={banks ?? []} onClose={() => setTransferOpen(false)} defaultBranchId={branchId} />}
      {expenseOpen && <ExpenseModal banks={banks ?? []} onClose={() => setExpenseOpen(false)} defaultBranchId={branchId} />}
      {bankForm && <BankAccountModal account={bankForm === 'new' ? undefined : bankForm} onClose={() => setBankForm(null)} />}
      {statementFor && <StatementModal account={statementFor} onClose={() => setStatementFor(null)} />}
      {cancelling && (
        <CancelModal
          label={cancelling.label}
          onClose={() => setCancelling(null)}
          onConfirm={async (reason) => {
            if (cancelling.type === 'transfer') await cancelCashTransfer(cancelling.id, reason);
            else await cancelExpense(cancelling.id, reason);
            invalidateFinancialViews(qc);
            setCancelling(null);
          }}
        />
      )}
    </div>
  );
}

/** Ligne de traçabilité : qui a saisi, quand ; qui a annulé, pourquoi. */
function trace(x: Pick<Expense, 'createdAt' | 'createdByName' | 'cancelledAt' | 'cancelledByName' | 'cancelReason'>): string[] {
  return [
    L('saisiParLe', { name: x.createdByName ?? '—', date: x.createdAt ? formatDateTime(x.createdAt) : '' }),
    ...(x.cancelledAt
      ? [L('annuleParLe', { name: x.cancelledByName ?? '—', date: formatDateTime(x.cancelledAt), reason: x.cancelReason ?? '' })]
      : []),
  ];
}

function Row({
  cancelled,
  icon,
  title,
  badges,
  details,
  trace: traceLines,
  amount,
  amountTone,
  date,
  attachmentUrl,
  onCancel,
}: {
  cancelled: boolean;
  icon: ReactNode;
  title: string;
  badges: ReactNode;
  details: (string | null | undefined)[];
  trace: string[];
  amount: string;
  amountTone: string;
  date: string;
  attachmentUrl?: string | null;
  onCancel?: () => void;
}) {
  const info = details.filter(Boolean);
  return (
    <div className={`card flex flex-wrap items-start gap-3 p-3 sm:flex-nowrap ${cancelled ? 'bg-surface-2/60 opacity-70' : ''}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`font-medium text-content ${cancelled ? 'line-through' : ''}`}>{title}</span>
          {badges}
          {cancelled && <Badge tone="danger">{L('annule')}</Badge>}
        </div>
        {info.length > 0 && <p className="mt-0.5 text-xs text-content-muted">{info.join(' · ')}</p>}
        <p className="mt-0.5 text-[11px] text-content-faint">{traceLines.join(' · ')}</p>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-3">
        {attachmentUrl && (
          <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-content-muted hover:text-primary" title={L('justificatif')}>
            <Paperclip className="h-4 w-4" />
          </a>
        )}
        <div className="text-right">
          <p className={`font-semibold ${cancelled ? 'text-content-faint line-through' : amountTone}`}>{amount}</p>
          <p className="text-xs text-content-faint">{date}</p>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="btn-ghost h-8 w-8 rounded-lg p-0 text-danger" title={L('annulerLEcriture')}>
            <Ban className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Photo du justificatif (bordereau, reçu, facture). */
function AttachmentPicker({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-3">
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setBusy(true);
          try {
            onChange(await uploadImageToSupabase(f, 'justificatifs', 1600, 900 * 1024));
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button type="button" variant="outline" loading={busy} onClick={() => ref.current?.click()}>
        <FileImage className="h-4 w-4" /> {value ? L('remplacerJustificatif') : L('joindreJustificatif')}
      </Button>
      {value && <img src={value} alt="" className="h-10 w-10 rounded-lg border object-cover" />}
    </div>
  );
}

function BranchSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: listBranches });
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{L('toutesNonPrecise')}</option>
      {branches?.map((b) => (
        <option key={b.id} value={b.id}>{b.name}</option>
      ))}
    </select>
  );
}

function BankSelect({ banks, value, onChange }: { banks: BankAccount[]; value: string; onChange: (v: string) => void }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{L('choisirCompte')}</option>
      {banks.filter((b) => b.active).map((b) => (
        <option key={b.id} value={b.id}>
          {b.bankName} · {b.accountName}
        </option>
      ))}
    </select>
  );
}

function TransferModal({ banks, onClose, defaultBranchId }: { banks: BankAccount[]; onClose: () => void; defaultBranchId?: string | null }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [f, setF] = useState({
    kind: 'CASH_TO_BANK' as Kind,
    label: '',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    branchId: defaultBranchId || '',
    bankAccountId: banks.find((b) => b.active)?.id ?? '',
    method: '',
    reference: '',
    counterparty: '',
    handledBy: '',
    notes: '',
    attachmentUrl: '',
  });
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const kind = KINDS.find((k) => k.value === f.kind)!;
  const needsBank = kind.bank !== 0;

  const mut = useMutation({
    mutationFn: () => {
      const amount = Number(f.amount);
      if (!f.label.trim()) throw new Error(L('libelleRequis'));
      if (!(amount > 0)) throw new Error(L('montantRequis'));
      if (needsBank && !f.bankAccountId) throw new Error(L('compteRequis'));
      const input: CashTransferCreateInput = {
        kind: f.kind,
        label: f.label.trim(),
        amount,
        date: f.date,
        branchId: f.branchId || undefined,
        bankAccountId: needsBank ? f.bankAccountId : undefined,
        method: (f.method || undefined) as CashTransferCreateInput['method'],
        reference: f.reference || undefined,
        counterparty: f.counterparty || undefined,
        handledBy: f.handledBy || undefined,
        notes: f.notes || undefined,
        attachmentUrl: f.attachmentUrl || undefined,
      };
      return createCashTransfer(input);
    },
    onSuccess: () => {
      invalidateFinancialViews(qc);
      onClose();
    },
    onError: (e) => setError(e instanceof Error && !('response' in e) ? e.message : apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title={L('nouveauVersement')} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => set('kind')(k.value)}
              className={`rounded-xl border p-2.5 text-left transition ${f.kind === k.value ? 'border-primary bg-primary/10' : 'hover:border-primary/50'}`}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold text-content">
                <k.icon className="h-4 w-4 text-primary" /> {kindLabel(k.value)}
              </span>
              <span className="mt-0.5 block text-[11px] text-content-muted">{kindHint(k.value)}</span>
            </button>
          ))}
        </div>

        {needsBank && (
          <Field label={L('compteBancaire')}>
            {banks.some((b) => b.active) ? (
              <BankSelect banks={banks} value={f.bankAccountId} onChange={set('bankAccountId')} />
            ) : (
              <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-content">{L('ajoutezUnCompteDabord')}</p>
            )}
          </Field>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={L('libelle')}>
            <input className="input" placeholder={L('exDepotEnBanqueApport')} value={f.label} onChange={(e) => set('label')(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={L('montantFcfa', { currency: currencySymbol() })}>
              <input className="input" type="number" min={0} value={f.amount} onChange={(e) => set('amount')(e.target.value)} />
            </Field>
            <Field label="Date">
              <input className="input" type="date" value={f.date} onChange={(e) => set('date')(e.target.value)} />
            </Field>
          </div>
          <Field label={L('modeDePaiement')}>
            <select className="input" value={f.method} onChange={(e) => set('method')(e.target.value)}>
              <option value="">—</option>
              {METHODS.map((m) => (
                <option key={m} value={m}>{L(`method_${m}`)}</option>
              ))}
            </select>
          </Field>
          <Field label={L('referenceBordereau')}>
            <input className="input" placeholder="N° 004512" value={f.reference} onChange={(e) => set('reference')(e.target.value)} />
          </Field>
          <Field label={L('tiers')}>
            <input className="input" placeholder={L('tiersPlaceholder')} value={f.counterparty} onChange={(e) => set('counterparty')(e.target.value)} />
          </Field>
          <Field label={L('effectuePar')}>
            <input className="input" placeholder={L('effectueParPlaceholder')} value={f.handledBy} onChange={(e) => set('handledBy')(e.target.value)} />
          </Field>
          <Field label={L('boutique')}>
            <BranchSelect value={f.branchId} onChange={set('branchId')} />
          </Field>
          <Field label="Note">
            <input className="input" value={f.notes} onChange={(e) => set('notes')(e.target.value)} />
          </Field>
        </div>
        <AttachmentPicker value={f.attachmentUrl} onChange={set('attachmentUrl')} />
        {!kind.cash && <p className="text-xs text-content-muted">{L('sansEffetCaisse')}</p>}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button type="button" variant="ghost" onClick={onClose}>{L('annuler')}</Button>
          <Button loading={mut.isPending} onClick={() => mut.mutate()}>{L('enregistrer')}</Button>
        </div>
      </div>
    </Modal>
  );
}

function ExpenseModal({ banks, onClose, defaultBranchId }: { banks: BankAccount[]; onClose: () => void; defaultBranchId?: string | null }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [f, setF] = useState({
    label: '',
    category: 'RENT',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    branchId: defaultBranchId || '',
    paymentSource: 'CASH' as (typeof SOURCES)[number],
    bankAccountId: banks.find((b) => b.active)?.id ?? '',
    payee: '',
    reference: '',
    notes: '',
    attachmentUrl: '',
  });
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const mut = useMutation({
    mutationFn: () => {
      const amount = Number(f.amount);
      if (!f.label.trim()) throw new Error(L('libelleRequis'));
      if (!(amount > 0)) throw new Error(L('montantRequis'));
      if (f.paymentSource === 'BANK' && !f.bankAccountId) throw new Error(L('compteRequis'));
      const input: ExpenseCreateInput = {
        label: f.label.trim(),
        category: f.category as ExpenseCreateInput['category'],
        amount,
        date: f.date,
        branchId: f.branchId || undefined,
        paymentSource: f.paymentSource,
        bankAccountId: f.paymentSource === 'BANK' ? f.bankAccountId : undefined,
        payee: f.payee || undefined,
        reference: f.reference || undefined,
        notes: f.notes || undefined,
        attachmentUrl: f.attachmentUrl || undefined,
      };
      return createExpense(input);
    },
    onSuccess: () => {
      invalidateFinancialViews(qc);
      onClose();
    },
    onError: (e) => setError(e instanceof Error && !('response' in e) ? e.message : apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title={L('nouvelleDepense')} size="lg">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={L('libelle')}>
            <input className="input" value={f.label} onChange={(e) => set('label')(e.target.value)} />
          </Field>
          <Field label={L('categorie')}>
            <select className="input" value={f.category} onChange={(e) => set('category')(e.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </Field>
          <Field label={L('montantFcfa', { currency: currencySymbol() })}>
            <input className="input" type="number" min={0} value={f.amount} onChange={(e) => set('amount')(e.target.value)} />
          </Field>
          <Field label="Date">
            <input className="input" type="date" value={f.date} onChange={(e) => set('date')(e.target.value)} />
          </Field>
          <Field label={L('payeAvec')}>
            <select className="input" value={f.paymentSource} onChange={(e) => set('paymentSource')(e.target.value)}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>{L(`source_${s}`)}</option>
              ))}
            </select>
          </Field>
          {f.paymentSource === 'BANK' ? (
            <Field label={L('compteDebite')}>
              {banks.some((b) => b.active) ? (
                <BankSelect banks={banks} value={f.bankAccountId} onChange={set('bankAccountId')} />
              ) : (
                <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-content">{L('ajoutezUnCompteDabord')}</p>
              )}
            </Field>
          ) : (
            <Field label={L('boutique')}>
              <BranchSelect value={f.branchId} onChange={set('branchId')} />
            </Field>
          )}
          <Field label={L('beneficiaire')}>
            <input className="input" placeholder={L('beneficiairePlaceholder')} value={f.payee} onChange={(e) => set('payee')(e.target.value)} />
          </Field>
          <Field label={L('referenceFacture')}>
            <input className="input" value={f.reference} onChange={(e) => set('reference')(e.target.value)} />
          </Field>
        </div>
        <Field label="Note">
          <input className="input" value={f.notes} onChange={(e) => set('notes')(e.target.value)} />
        </Field>
        <AttachmentPicker value={f.attachmentUrl} onChange={set('attachmentUrl')} />
        {f.paymentSource !== 'CASH' && <p className="text-xs text-content-muted">{L('sansEffetCaisse')}</p>}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button type="button" variant="ghost" onClick={onClose}>{L('annuler')}</Button>
          <Button loading={mut.isPending} onClick={() => mut.mutate()}>{L('enregistrer')}</Button>
        </div>
      </div>
    </Modal>
  );
}

function BankAccountModal({ account, onClose }: { account?: BankAccount; onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [f, setF] = useState({
    bankName: account?.bankName ?? '',
    accountName: account?.accountName ?? '',
    accountNumber: account?.accountNumber ?? '',
    iban: account?.iban ?? '',
    swift: account?.swift ?? '',
    openingBalance: account ? String(Number(account.openingBalance)) : '0',
    notes: account?.notes ?? '',
    active: account?.active ?? true,
  });
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const mut = useMutation({
    mutationFn: () => {
      const input: BankAccountCreateInput = {
        bankName: f.bankName.trim(),
        accountName: f.accountName.trim(),
        accountNumber: f.accountNumber,
        iban: f.iban,
        swift: f.swift,
        openingBalance: Number(f.openingBalance) || 0,
        notes: f.notes,
        active: f.active,
      };
      return account ? updateBankAccount(account.id, input) : createBankAccount(input);
    },
    onSuccess: () => {
      invalidateFinancialViews(qc);
      void qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });
  return (
    <Modal open onClose={onClose} title={account ? L('modifierLeCompte') : L('nouveauCompteBancaire')} size="md">
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={L('banque')}>
            <input className="input" placeholder="BGFIBank, UBA, Ecobank…" value={f.bankName} onChange={(e) => set('bankName')(e.target.value)} />
          </Field>
          <Field label={L('intitule')}>
            <input className="input" placeholder={L('intitulePlaceholder')} value={f.accountName} onChange={(e) => set('accountName')(e.target.value)} />
          </Field>
          <Field label={L('numeroDeCompte')}>
            <input className="input font-mono" value={f.accountNumber} onChange={(e) => set('accountNumber')(e.target.value)} />
          </Field>
          <Field label="IBAN / RIB">
            <input className="input font-mono" value={f.iban} onChange={(e) => set('iban')(e.target.value)} />
          </Field>
          <Field label="SWIFT / BIC">
            <input className="input font-mono" value={f.swift} onChange={(e) => set('swift')(e.target.value)} />
          </Field>
          <Field label={L('soldeDouverture', { currency: currencySymbol() })}>
            <input className="input" type="number" value={f.openingBalance} onChange={(e) => set('openingBalance')(e.target.value)} />
          </Field>
        </div>
        <Field label="Note">
          <input className="input" value={f.notes} onChange={(e) => set('notes')(e.target.value)} />
        </Field>
        {account && (
          <label className="flex items-center gap-2 text-sm text-content">
            <input type="checkbox" checked={f.active} onChange={(e) => setF((s) => ({ ...s, active: e.target.checked }))} /> {L('compteActif')}
          </label>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button type="button" variant="ghost" onClick={onClose}>{L('annuler')}</Button>
          <Button loading={mut.isPending} disabled={f.bankName.trim().length < 2 || f.accountName.trim().length < 2} onClick={() => mut.mutate()}>
            {L('enregistrer')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function StatementModal({ account, onClose }: { account: BankAccount; onClose: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['bank-statement', account.id], queryFn: () => getBankStatement(account.id) });
  return (
    <Modal open onClose={onClose} title={L('releveDe', { name: `${account.bankName} · ${account.accountName}` })} size="lg">
      {isLoading || !data ? (
        <PageLoader />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap justify-between gap-2 rounded-xl bg-surface-2 p-3 text-sm">
            <span className="text-content-muted">{L('soldeOuverture')} <b className="text-content">{formatCurrency(data.openingBalance)}</b></span>
            <span className="text-content-muted">{L('soldeActuel')} <b className="text-content">{formatCurrency(data.balance)}</b></span>
          </div>
          {data.lines.length === 0 ? (
            <p className="text-sm text-content-muted">{L('aucunMouvement')}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                    <th className="table-cell font-semibold">Date</th>
                    <th className="table-cell font-semibold">{L('operation')}</th>
                    <th className="table-cell text-right font-semibold">{L('montant')}</th>
                    <th className="table-cell text-right font-semibold">{L('solde')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((l) => (
                    <tr key={`${l.type}-${l.id}`} className="border-b last:border-0">
                      <td className="table-cell whitespace-nowrap text-content-muted">{formatDate(l.date)}</td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1.5 text-content">
                          <ArrowRightLeft className="h-3.5 w-3.5 text-content-faint" />
                          {l.label}
                        </div>
                        <div className="text-xs text-content-faint">
                          {[l.type === 'EXPENSE' ? L('depense') : l.kind ? kindLabel(l.kind as Kind) : null, l.reference, l.counterparty]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </td>
                      <td className={`table-cell whitespace-nowrap text-right font-semibold ${l.signed >= 0 ? 'text-success' : 'text-danger'}`}>
                        {l.signed >= 0 ? '+' : '−'} {formatCurrency(Math.abs(l.signed))}
                      </td>
                      <td className="table-cell whitespace-nowrap text-right text-content">{formatCurrency(l.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function CancelModal({ label, onClose, onConfirm }: { label: string; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Modal open onClose={onClose} title={L('annulerX', { label })} size="sm">
      <div className="space-y-3">
        <p className="text-sm text-content-muted">{L('annulationExplication')}</p>
        <textarea className="input min-h-[80px]" placeholder={L('motifPlaceholder')} value={reason} onChange={(e) => setReason(e.target.value)} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{L('retour')}</Button>
          <Button
            variant="danger"
            loading={busy}
            disabled={reason.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(reason.trim());
              } catch (e) {
                setError(apiErrorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {L('confirmerLAnnulation')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
