import { useMemo, useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  TrendingDown,
  Landmark,
  Ban,
  Link2,
  ArrowRightLeft,
  Pencil,
  ScrollText,
  Smartphone,
  Vault,
  CreditCard,
  Download,
  Search,
  ExternalLink,
  Trash2,
  History,
  X,
} from 'lucide-react';
import type { CashTransferCreateInput, ExpenseCreateInput, BankAccountCreateInput, FinanceLink } from '@oculo/shared-types';
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
  getFinanceHistory,
  type BankAccount,
  type CashTransfer,
  type Expense,
} from '../../features/management/api';
import { listBranches } from '../../features/optique/api';
import { useUIStore } from '../../store/ui';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { invalidateFinancialViews } from '../../lib/queryInvalidation';
import { downloadCsv } from '../../lib/csv';
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
/** Types de mouvement : effet sur la caisse (espèces) et sur le compte choisi. */
const KINDS: { value: Kind; icon: typeof Wallet; cash: -1 | 0 | 1; account: -1 | 0 | 1 }[] = [
  { value: 'CASH_IN', icon: ArrowDownCircle, cash: 1, account: 0 },
  { value: 'CASH_OUT', icon: ArrowUpCircle, cash: -1, account: 0 },
  { value: 'CASH_TO_BANK', icon: Landmark, cash: -1, account: 1 },
  { value: 'BANK_TO_CASH', icon: Wallet, cash: 1, account: -1 },
  { value: 'BANK_IN', icon: ArrowDownCircle, cash: 0, account: 1 },
  { value: 'BANK_OUT', icon: ArrowUpCircle, cash: 0, account: -1 },
  { value: 'ACCOUNT_TRANSFER', icon: ArrowRightLeft, cash: 0, account: 0 },
];
const kindLabel = (k: string) => L(`kind_${k}`);
const METHODS = ['ESPECES', 'VIREMENT', 'MOBILE_MONEY', 'CHEQUE', 'CARTE', 'DEPOT'] as const;
const SOURCES = ['CASH', 'MOBILE_MONEY', 'BANK', 'CARD', 'CHEQUE'] as const;
const ACCOUNT_TYPES = ['BANK', 'MOBILE_MONEY', 'SAFE', 'OTHER'] as const;
const PROVIDERS = ['ORANGE_MONEY', 'WAVE', 'MTN_MOMO', 'MOOV_MONEY', 'AIRTEL_MONEY', 'FREE_MONEY', 'T_MONEY', 'OTHER'] as const;
const PROVIDER_LABEL: Record<string, string> = {
  ORANGE_MONEY: 'Orange Money',
  WAVE: 'Wave',
  MTN_MOMO: 'MTN MoMo',
  MOOV_MONEY: 'Moov Money',
  AIRTEL_MONEY: 'Airtel Money',
  FREE_MONEY: 'Free Money',
  T_MONEY: 'T-Money',
};
/** Couleur repère de chaque opérateur (pastille de la carte du compte). */
const PROVIDER_COLOR: Record<string, string> = {
  ORANGE_MONEY: 'bg-orange-500',
  WAVE: 'bg-sky-400',
  MTN_MOMO: 'bg-yellow-400',
  MOOV_MONEY: 'bg-blue-600',
  AIRTEL_MONEY: 'bg-red-600',
  FREE_MONEY: 'bg-red-500',
  T_MONEY: 'bg-yellow-500',
};
const providerLabel = (p?: string | null) => (p ? PROVIDER_LABEL[p] ?? L('autreOperateur') : null);

function AccountIcon({ account, className = 'h-4 w-4' }: { account: Pick<BankAccount, 'type' | 'provider'>; className?: string }) {
  if (account.type === 'MOBILE_MONEY') return <Smartphone className={className} />;
  if (account.type === 'SAFE') return <Vault className={className} />;
  if (account.type === 'OTHER') return <CreditCard className={className} />;
  return <Landmark className={className} />;
}
const accountName = (a?: { bankName: string; accountName: string } | null) => (a ? `${a.bankName} · ${a.accountName}` : null);

/** Écriture du journal : mouvement ou dépense, ramenés à une forme commune. */
interface JournalEntry {
  id: string;
  entity: 'CashTransfer' | 'Expense';
  date: string;
  label: string;
  typeLabel: string;
  meansLabel: string | null;
  accountLabel: string | null;
  amount: number;
  sign: 1 | -1 | 0;
  affectsCash: boolean;
  createdByName: string | null;
  cancelled: boolean;
  links: { label?: string; url: string }[];
  raw: CashTransfer | Expense;
}

function monthStartIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function linksOf(x: { links?: { label?: string; url: string }[] | null; attachmentUrl?: string | null }) {
  const out = [...(x.links ?? [])];
  if (x.attachmentUrl) out.push({ label: L('justificatif'), url: x.attachmentUrl });
  return out;
}

type Tab = 'journal' | 'accounts';

/**
 * Dépenses et versements : un journal unique (mouvements + dépenses) avec
 * filtres, fiche détaillée et historique de chaque écriture, et les comptes
 * de paiement (banque, mobile money, coffre). Rien n'est supprimé : une
 * écriture erronée est annulée avec un motif. Les justificatifs sont des
 * liens (Drive, Dropbox…) : aucun fichier n'est stocké par OculoSaaS.
 */
export function CashFlowPage() {
  const qc = useQueryClient();
  const branchId = useUIStore((s) => s.activeBranchId);
  const canCreate = usePermission('finance.expenses.create');
  const canCancel = usePermission('finance.expenses.delete');

  const [tab, setTab] = useState<Tab>('journal');
  const [transferOpen, setTransferOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [accountForm, setAccountForm] = useState<BankAccount | 'new' | null>(null);
  const [statementFor, setStatementFor] = useState<BankAccount | null>(null);
  const [detail, setDetail] = useState<JournalEntry | null>(null);
  const [cancelling, setCancelling] = useState<JournalEntry | null>(null);

  // Filtres du journal.
  const [from, setFrom] = useState(monthStartIso());
  const [to, setTo] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [entityFilter, setEntityFilter] = useState<'all' | 'CashTransfer' | 'Expense'>('all');
  const [accountFilter, setAccountFilter] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');
  const [search, setSearch] = useState('');
  const filters = { from, to, includeCancelled: showCancelled };

  const { data: cash, isLoading: loadingCash } = useQuery({
    queryKey: ['cash-transfers', branchId, filters],
    queryFn: () => listCashTransfers(branchId ?? undefined, filters),
  });
  const { data: expenses, isLoading: loadingExpenses } = useQuery({
    queryKey: ['expenses', branchId, filters],
    queryFn: () => listExpenses(branchId ?? undefined, filters),
  });
  const { data: accounts } = useQuery({ queryKey: ['bank-accounts'], queryFn: listBankAccounts });
  const activeAccounts = (accounts ?? []).filter((a) => a.active);

  const journal = useMemo<JournalEntry[]>(() => {
    const rows: JournalEntry[] = [];
    for (const t of cash?.transfers ?? []) {
      const k = KINDS.find((x) => x.value === t.kind) ?? KINDS[0];
      const sign = k.cash !== 0 ? k.cash : k.account;
      rows.push({
        id: t.id,
        entity: 'CashTransfer',
        date: t.date,
        label: t.label,
        typeLabel: kindLabel(t.kind),
        meansLabel: t.method ? L(`method_${t.method}`) : null,
        accountLabel:
          t.kind === 'ACCOUNT_TRANSFER'
            ? `${accountName(t.bankAccount) ?? '?'} → ${accountName(t.toAccount) ?? '?'}`
            : accountName(t.bankAccount),
        amount: Number(t.amount),
        sign,
        affectsCash: t.affectsCash ?? true,
        createdByName: t.createdByName ?? null,
        cancelled: Boolean(t.cancelledAt),
        links: linksOf(t),
        raw: t,
      });
    }
    for (const e of expenses ?? []) {
      rows.push({
        id: e.id,
        entity: 'Expense',
        date: e.date,
        label: e.label,
        typeLabel: `${L('depense')} · ${expenseCatLabel(e.category)}`,
        meansLabel: L(`source_${e.paymentSource ?? 'CASH'}`),
        accountLabel: accountName(e.bankAccount),
        amount: Number(e.amount),
        sign: -1,
        affectsCash: (e.paymentSource ?? 'CASH') === 'CASH',
        createdByName: e.createdByName ?? null,
        cancelled: Boolean(e.cancelledAt),
        links: linksOf(e),
        raw: e,
      });
    }
    return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [cash, expenses]);

  const authors = useMemo(() => [...new Set(journal.map((j) => j.createdByName).filter(Boolean))] as string[], [journal]);
  const selectedAccount = accounts?.find((a) => a.id === accountFilter);
  const visible = journal.filter((j) => {
    if (entityFilter !== 'all' && j.entity !== entityFilter) return false;
    if (authorFilter && j.createdByName !== authorFilter) return false;
    if (selectedAccount && !(j.accountLabel ?? '').includes(`${selectedAccount.bankName} · ${selectedAccount.accountName}`)) return false;
    if (search) {
      const r = j.raw as Partial<CashTransfer & Expense>;
      const hay = [j.label, j.typeLabel, j.accountLabel, r.reference, r.counterparty, r.payee, r.handledBy, r.notes].join(' ').toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const valid = journal.filter((j) => !j.cancelled);
  const cashIn = valid.filter((j) => j.affectsCash && j.sign > 0).reduce((s, j) => s + j.amount, 0);
  const cashOut = valid.filter((j) => j.affectsCash && j.sign < 0).reduce((s, j) => s + j.amount, 0);
  const expensesTotal = valid.filter((j) => j.entity === 'Expense').reduce((s, j) => s + j.amount, 0);
  const accountsTotal = activeAccounts.reduce((s, a) => s + a.balance, 0);

  function exportCsv() {
    downloadCsv(
      `journal-tresorerie-${new Date().toISOString().slice(0, 10)}.csv`,
      [L('colDate'), L('colType'), L('libelle'), L('colMoyen'), L('colCompte'), L('montant'), L('colReference'), L('colTiers'), L('colSaisiPar'), L('colStatut'), L('colLiens')],
      visible.map((j) => {
        const r = j.raw as Partial<CashTransfer & Expense>;
        return [
          formatDate(j.date),
          j.typeLabel,
          j.label,
          j.meansLabel ?? '',
          j.accountLabel ?? '',
          j.sign < 0 ? -j.amount : j.amount,
          r.reference ?? '',
          r.counterparty ?? r.payee ?? '',
          j.createdByName ?? '',
          j.cancelled ? `${L('annule')} : ${r.cancelReason ?? ''}` : L('valide'),
          j.links.map((l) => l.url).join(' '),
        ];
      }),
    );
  }

  return (
    <div>
      <PageHeader
        title={L('depensesVersements')}
        subtitle={L('sousTitreDetaille')}
        actions={
          canCreate && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setAccountForm('new')}>
                <Plus className="h-4 w-4" /> {L('compte')}
              </Button>
              <Button variant="outline" onClick={() => setExpenseOpen(true)}>
                <Plus className="h-4 w-4" /> {L('depense')}
              </Button>
              <Button onClick={() => setTransferOpen(true)}>
                <Plus className="h-4 w-4" /> {L('mouvement')}
              </Button>
            </div>
          )
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ArrowDownCircle} label={L('entreesCaisse')} value={formatCurrency(cashIn)} hint={L('surLaPeriode')} tone="success" />
        <StatCard icon={ArrowUpCircle} label={L('sortiesCaisse')} value={formatCurrency(cashOut)} hint={L('surLaPeriode')} tone="danger" />
        <StatCard icon={TrendingDown} label={L('depensesDExploitation')} value={formatCurrency(expensesTotal)} hint={L('tousMoyens')} tone="danger" />
        <StatCard icon={Wallet} label={L('soldeComptes')} value={formatCurrency(accountsTotal)} hint={L('nComptesActifs', { n: activeAccounts.length })} tone={accountsTotal >= 0 ? 'primary' : 'danger'} />
      </div>

      {/* Comptes : toujours visibles, un clic ouvre le relevé. */}
      {activeAccounts.length > 0 && (
        <div className="mb-5 flex gap-3 overflow-x-auto pb-1">
          {activeAccounts.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setStatementFor(a)}
              className="min-w-[200px] shrink-0 rounded-2xl border bg-surface p-3 text-left transition hover:border-primary"
            >
              <span className="flex items-center gap-2 text-xs font-semibold text-content-muted">
                <span className={`grid h-6 w-6 place-items-center rounded-lg text-white ${a.provider ? PROVIDER_COLOR[a.provider] ?? 'bg-primary' : 'bg-primary'}`}>
                  <AccountIcon account={a} className="h-3.5 w-3.5" />
                </span>
                <span className="truncate">{providerLabel(a.provider) ?? a.bankName}</span>
              </span>
              <span className="mt-1 block truncate text-xs text-content-faint">{a.accountName}</span>
              <span className={`mt-1 block font-display text-lg font-bold ${a.balance >= 0 ? 'text-content' : 'text-danger'}`}>{formatCurrency(a.balance)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-1 border-b">
        {([
          { key: 'journal' as Tab, label: L('journal') },
          { key: 'accounts' as Tab, label: L('comptes') },
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

      {tab === 'journal' && (
        <>
          <div className="card mb-3 grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-6">
            <label className="text-xs text-content-muted">
              {L('du')}
              <input type="date" className="input mt-1 py-1.5 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="text-xs text-content-muted">
              {L('au')}
              <input type="date" className="input mt-1 py-1.5 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <label className="text-xs text-content-muted">
              {L('colType')}
              <select className="input mt-1 py-1.5 text-sm" value={entityFilter} onChange={(e) => setEntityFilter(e.target.value as typeof entityFilter)}>
                <option value="all">{L('tout')}</option>
                <option value="CashTransfer">{L('mouvements')}</option>
                <option value="Expense">{L('depenses')}</option>
              </select>
            </label>
            <label className="text-xs text-content-muted">
              {L('colCompte')}
              <select className="input mt-1 py-1.5 text-sm" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
                <option value="">{L('tous')}</option>
                {(accounts ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.bankName} · {a.accountName}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-content-muted">
              {L('colSaisiPar')}
              <select className="input mt-1 py-1.5 text-sm" value={authorFilter} onChange={(e) => setAuthorFilter(e.target.value)}>
                <option value="">{L('tous')}</option>
                {authors.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-content-muted">
              {L('rechercher')}
              <span className="relative mt-1 block">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-content-faint" />
                <input className="input py-1.5 pl-8 text-sm" placeholder={L('rechercherPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
              </span>
            </label>
            <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2 lg:col-span-6">
              <label className="flex items-center gap-1.5 text-sm text-content">
                <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
                {L('afficherAnnules')}
              </label>
              <div className="flex items-center gap-3 text-xs text-content-muted">
                <span>{L('nEcritures', { n: visible.length })}</span>
                <Button variant="outline" className="h-8 px-3 text-xs" disabled={visible.length === 0} onClick={exportCsv}>
                  <Download className="h-3.5 w-3.5" /> {L('exporterCsv')}
                </Button>
              </div>
            </div>
          </div>

          {loadingCash || loadingExpenses ? (
            <PageLoader />
          ) : visible.length === 0 ? (
            <EmptyState icon={ScrollText} title={L('aucuneEcriture')} hint={L('enregistrezLesApportsDArgent')} />
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                    <th className="table-cell font-semibold">{L('colDate')}</th>
                    <th className="table-cell font-semibold">{L('libelle')}</th>
                    <th className="table-cell font-semibold">{L('colType')}</th>
                    <th className="table-cell font-semibold">{L('colCompte')}</th>
                    <th className="table-cell font-semibold">{L('colSaisiPar')}</th>
                    <th className="table-cell text-right font-semibold">{L('montant')}</th>
                    <th className="table-cell" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((j) => (
                    <tr
                      key={`${j.entity}-${j.id}`}
                      onClick={() => setDetail(j)}
                      className={`cursor-pointer border-b last:border-0 hover:bg-surface-2/50 ${j.cancelled ? 'opacity-60' : ''}`}
                    >
                      <td className="table-cell whitespace-nowrap text-content-muted">{formatDate(j.date)}</td>
                      <td className="table-cell">
                        <span className={`font-medium text-content ${j.cancelled ? 'line-through' : ''}`}>{j.label}</span>
                        <span className="mt-0.5 flex flex-wrap gap-1">
                          {j.cancelled && <Badge tone="danger">{L('annule')}</Badge>}
                          {!j.affectsCash && !j.cancelled && <Badge tone="neutral">{L('horsCaisse')}</Badge>}
                          {j.links.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] text-primary">
                              <Link2 className="h-3 w-3" /> {j.links.length}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className="text-content">{j.typeLabel}</span>
                        {j.meansLabel && <span className="block text-xs text-content-faint">{j.meansLabel}</span>}
                      </td>
                      <td className="table-cell text-xs text-content-muted">{j.accountLabel ?? (j.affectsCash ? L('caisse') : '—')}</td>
                      <td className="table-cell text-xs text-content-muted">{j.createdByName ?? '—'}</td>
                      <td
                        className={`table-cell whitespace-nowrap text-right font-semibold ${
                          j.cancelled ? 'text-content-faint line-through' : j.sign > 0 ? 'text-success' : j.sign < 0 ? 'text-danger' : 'text-content'
                        }`}
                      >
                        {j.sign > 0 ? '+' : j.sign < 0 ? '−' : '⇄'} {formatCurrency(j.amount)}
                      </td>
                      <td className="table-cell text-right">
                        {canCancel && !j.cancelled && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCancelling(j);
                            }}
                            className="btn-ghost h-8 w-8 rounded-lg p-0 text-danger"
                            title={L('annulerLEcriture')}
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'accounts' &&
        (!accounts || accounts.length === 0 ? (
          <EmptyState icon={Wallet} title={L('aucunCompte')} hint={L('ajoutezVosComptes')} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((a) => (
              <div key={a.id} className={`card p-4 ${a.active ? '' : 'opacity-60'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white ${a.provider ? PROVIDER_COLOR[a.provider] ?? 'bg-primary' : 'bg-primary'}`}>
                      <AccountIcon account={a} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-content">{providerLabel(a.provider) ?? a.bankName}</p>
                      <p className="truncate text-sm text-content-muted">{a.accountName}</p>
                      <p className="mt-0.5 truncate font-mono text-xs text-content-faint">
                        {a.type === 'MOBILE_MONEY' ? a.phoneNumber : a.iban || a.accountNumber}
                      </p>
                    </div>
                  </div>
                  <Badge tone={a.active ? 'info' : 'neutral'}>{a.active ? L(`type_${a.type}`) : L('inactif')}</Badge>
                </div>
                <p className={`mt-3 font-display text-2xl font-bold ${a.balance >= 0 ? 'text-content' : 'text-danger'}`}>{formatCurrency(a.balance)}</p>
                <p className="text-xs text-content-faint">
                  {L('creditsDebits', { credits: formatCurrency(a.credits), debits: formatCurrency(a.debits), n: a.movements })}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" className="h-8 flex-1 px-2 text-xs" onClick={() => setStatementFor(a)}>
                    <ScrollText className="h-3.5 w-3.5" /> {L('releve')}
                  </Button>
                  {canCreate && (
                    <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => setAccountForm(a)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}

      {transferOpen && <TransferModal accounts={activeAccounts} onClose={() => setTransferOpen(false)} defaultBranchId={branchId} />}
      {expenseOpen && <ExpenseModal accounts={activeAccounts} onClose={() => setExpenseOpen(false)} defaultBranchId={branchId} />}
      {accountForm && <AccountModal account={accountForm === 'new' ? undefined : accountForm} onClose={() => setAccountForm(null)} />}
      {statementFor && <StatementModal account={statementFor} onClose={() => setStatementFor(null)} />}
      {detail && (
        <DetailModal
          entry={detail}
          onClose={() => setDetail(null)}
          onCancel={canCancel && !detail.cancelled ? () => { setCancelling(detail); setDetail(null); } : undefined}
        />
      )}
      {cancelling && (
        <CancelModal
          label={cancelling.label}
          onClose={() => setCancelling(null)}
          onConfirm={async (reason) => {
            if (cancelling.entity === 'CashTransfer') await cancelCashTransfer(cancelling.id, reason);
            else await cancelExpense(cancelling.id, reason);
            invalidateFinancialViews(qc);
            setCancelling(null);
          }}
        />
      )}
    </div>
  );
}

/* --------------------------------- Fiche détaillée --------------------------------- */

function DetailModal({ entry, onClose, onCancel }: { entry: JournalEntry; onClose: () => void; onCancel?: () => void }) {
  const r = entry.raw as Partial<CashTransfer & Expense>;
  const { data: history } = useQuery({
    queryKey: ['finance-history', entry.entity, entry.id],
    queryFn: () => getFinanceHistory(entry.entity, entry.id),
  });
  const rows: [string, ReactNode][] = [
    [L('colType'), entry.typeLabel],
    [L('montant'), <b key="m">{formatCurrency(entry.amount)}</b>],
    [L('colDate'), formatDate(entry.date)],
    [L('colMoyen'), entry.meansLabel],
    [L('colCompte'), entry.accountLabel ?? (entry.affectsCash ? L('caisse') : null)],
    [L('effetCaisse'), entry.affectsCash ? L('oui') : L('non')],
    [L('colReference'), r.reference],
    [L('colTiers'), r.counterparty ?? r.payee],
    [L('effectuePar'), r.handledBy],
    ['Note', r.notes],
    [L('colSaisiPar'), entry.createdByName ? `${entry.createdByName} · ${r.createdAt ? formatDateTime(r.createdAt) : ''}` : null],
  ];
  return (
    <Modal open onClose={onClose} title={entry.label} size="lg">
      <div className="space-y-4">
        {entry.cancelled && (
          <div className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-content">
            <b>{L('annule')}</b> — {r.cancelledByName ?? '—'} · {r.cancelledAt ? formatDateTime(r.cancelledAt) : ''}
            <br />
            {L('motif')} : {r.cancelReason}
          </div>
        )}
        <dl className="grid gap-x-6 gap-y-2 rounded-xl border p-3 text-sm sm:grid-cols-2">
          {rows
            .filter(([, v]) => v !== null && v !== undefined && v !== '')
            .map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-dashed pb-1.5 last:border-0">
                <dt className="text-content-muted">{k}</dt>
                <dd className="text-right text-content">{v}</dd>
              </div>
            ))}
        </dl>

        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-content">
            <Link2 className="h-4 w-4 text-primary" /> {L('justificatifs')}
          </h4>
          {entry.links.length === 0 ? (
            <p className="text-sm text-content-muted">{L('aucunJustificatif')}</p>
          ) : (
            <ul className="space-y-1.5">
              {entry.links.map((l, i) => (
                <li key={i}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-primary hover:bg-primary/5">
                    <ExternalLink className="h-4 w-4 shrink-0" />
                    <span className="truncate">{l.label || l.url}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-content">
            <History className="h-4 w-4 text-primary" /> {L('historique')}
          </h4>
          {!history || history.length === 0 ? (
            // Écriture antérieure au journal : on montre au moins sa création.
            <p className="text-sm text-content-muted">
              {entry.createdByName || r.createdAt
                ? L('enregistreParLe', { name: entry.createdByName ?? '—', date: r.createdAt ? formatDateTime(r.createdAt) : '' })
                : L('aucunHistorique')}
            </p>
          ) : (
            <ol className="space-y-2 border-l-2 border-line pl-4">
              {history.map((h) => (
                <li key={h.id} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                  <span className="font-medium text-content">{L(`action_${h.action}`)}</span>
                  <span className="block text-xs text-content-faint">
                    {formatDateTime(h.createdAt)}
                    {h.user ? ` · ${h.user.firstName} ${h.user.lastName}` : ''}
                    {typeof h.metadata?.reason === 'string' ? ` · ${h.metadata.reason}` : ''}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t pt-3">
          {onCancel && (
            <Button variant="danger" onClick={onCancel}>
              <Ban className="h-4 w-4" /> {L('annulerLEcriture')}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>{L('fermer')}</Button>
        </div>
      </div>
    </Modal>
  );
}

/* --------------------------------- Justificatifs en liens --------------------------------- */

/**
 * Justificatifs sous forme de liens : le fichier reste dans le Drive, Dropbox
 * ou WhatsApp de l'établissement, rien n'est stocké par OculoSaaS.
 */
function LinksEditor({ value, onChange }: { value: FinanceLink[]; onChange: (v: FinanceLink[]) => void }) {
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const valid = /^https?:\/\/\S+\.\S+/.test(url.trim());
  return (
    <div className="space-y-2 rounded-xl border border-dashed p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-content">
        <Link2 className="h-4 w-4 text-primary" /> {L('justificatifsLiens')}
      </p>
      <p className="text-xs text-content-muted">
        {L('liensExplication')}{' '}
        <a href="https://drive.google.com/drive/my-drive" target="_blank" rel="noopener noreferrer" className="text-primary underline">
          Google Drive
        </a>
        {' · '}
        <a href="https://www.dropbox.com/home" target="_blank" rel="noopener noreferrer" className="text-primary underline">
          Dropbox
        </a>
      </p>
      {value.map((l, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg bg-surface-2 px-2 py-1.5 text-xs">
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate">{l.label ? `${l.label} — ` : ''}{l.url}</span>
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-content-faint hover:text-danger">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {value.length < 10 && (
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <input className="input py-1.5 text-sm" placeholder={L('nomDuDocument')} value={label} onChange={(e) => setLabel(e.target.value)} />
          <input className="input py-1.5 text-sm" placeholder="https://drive.google.com/…" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button
            type="button"
            variant="outline"
            className="h-9 px-3 text-xs"
            disabled={!valid}
            onClick={() => {
              onChange([...value, { label: label.trim(), url: url.trim() }]);
              setUrl('');
              setLabel('');
            }}
          >
            <Plus className="h-3.5 w-3.5" /> {L('ajouter')}
          </Button>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Formulaires --------------------------------- */

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

function AccountSelect({ accounts, value, onChange, exclude }: { accounts: BankAccount[]; value: string; onChange: (v: string) => void; exclude?: string }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{L('choisirCompte')}</option>
      {accounts.filter((a) => a.id !== exclude).map((a) => (
        <option key={a.id} value={a.id}>
          {providerLabel(a.provider) ?? a.bankName} · {a.accountName}
        </option>
      ))}
    </select>
  );
}

function NoAccountHint() {
  return <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-content">{L('ajoutezUnCompteDabord')}</p>;
}

function TransferModal({ accounts, onClose, defaultBranchId }: { accounts: BankAccount[]; onClose: () => void; defaultBranchId?: string | null }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [links, setLinks] = useState<FinanceLink[]>([]);
  const [f, setF] = useState({
    kind: 'CASH_TO_BANK' as Kind,
    label: '',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    branchId: defaultBranchId || '',
    bankAccountId: accounts[0]?.id ?? '',
    toAccountId: accounts[1]?.id ?? '',
    method: '',
    reference: '',
    counterparty: '',
    handledBy: '',
    notes: '',
  });
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const kind = KINDS.find((k) => k.value === f.kind)!;
  const needsAccount = kind.account !== 0 || f.kind === 'ACCOUNT_TRANSFER';

  const mut = useMutation({
    mutationFn: () => {
      const amount = Number(f.amount);
      if (!f.label.trim()) throw new Error(L('libelleRequis'));
      if (!(amount > 0)) throw new Error(L('montantRequis'));
      if (needsAccount && !f.bankAccountId) throw new Error(L('compteRequis'));
      if (f.kind === 'ACCOUNT_TRANSFER' && (!f.toAccountId || f.toAccountId === f.bankAccountId)) throw new Error(L('compteDestRequis'));
      const input: CashTransferCreateInput = {
        kind: f.kind,
        label: f.label.trim(),
        amount,
        date: f.date,
        branchId: f.branchId || undefined,
        bankAccountId: needsAccount ? f.bankAccountId : undefined,
        toAccountId: f.kind === 'ACCOUNT_TRANSFER' ? f.toAccountId : undefined,
        method: (f.method || undefined) as CashTransferCreateInput['method'],
        reference: f.reference || undefined,
        counterparty: f.counterparty || undefined,
        handledBy: f.handledBy || undefined,
        notes: f.notes || undefined,
        links,
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
    <Modal open onClose={onClose} title={L('nouveauMouvement')} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => set('kind')(k.value)}
              className={`rounded-xl border p-2.5 text-left transition ${f.kind === k.value ? 'border-primary bg-primary/10' : 'hover:border-primary/50'}`}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold text-content">
                <k.icon className="h-4 w-4 shrink-0 text-primary" /> {kindLabel(k.value)}
              </span>
              <span className="mt-0.5 block text-[11px] text-content-muted">{L(`kindHint_${k.value}`)}</span>
            </button>
          ))}
        </div>

        {needsAccount &&
          (accounts.length === 0 ? (
            <NoAccountHint />
          ) : f.kind === 'ACCOUNT_TRANSFER' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={L('compteSource')}>
                <AccountSelect accounts={accounts} value={f.bankAccountId} onChange={set('bankAccountId')} />
              </Field>
              <Field label={L('compteDestinataire')}>
                <AccountSelect accounts={accounts} value={f.toAccountId} onChange={set('toAccountId')} exclude={f.bankAccountId} />
              </Field>
            </div>
          ) : (
            <Field label={L('compte')}>
              <AccountSelect accounts={accounts} value={f.bankAccountId} onChange={set('bankAccountId')} />
            </Field>
          ))}

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
            <input className="input" placeholder={L('referencePlaceholder')} value={f.reference} onChange={(e) => set('reference')(e.target.value)} />
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
        <LinksEditor value={links} onChange={setLinks} />
        {kind.cash === 0 && <p className="text-xs text-content-muted">{L('sansEffetCaisse')}</p>}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button type="button" variant="ghost" onClick={onClose}>{L('annuler')}</Button>
          <Button loading={mut.isPending} onClick={() => mut.mutate()}>{L('enregistrer')}</Button>
        </div>
      </div>
    </Modal>
  );
}

function ExpenseModal({ accounts, onClose, defaultBranchId }: { accounts: BankAccount[]; onClose: () => void; defaultBranchId?: string | null }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [links, setLinks] = useState<FinanceLink[]>([]);
  const [f, setF] = useState({
    label: '',
    category: 'RENT',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    branchId: defaultBranchId || '',
    paymentSource: 'CASH' as (typeof SOURCES)[number],
    bankAccountId: '',
    payee: '',
    reference: '',
    notes: '',
  });
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  // Comptes proposés selon le moyen : mobile money → comptes mobile money, banque/carte/chèque → banques.
  const usable = accounts.filter((a) =>
    f.paymentSource === 'MOBILE_MONEY' ? a.type === 'MOBILE_MONEY' : a.type === 'BANK' || a.type === 'OTHER',
  );

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
        bankAccountId: f.paymentSource !== 'CASH' && f.bankAccountId ? f.bankAccountId : undefined,
        payee: f.payee || undefined,
        reference: f.reference || undefined,
        notes: f.notes || undefined,
        links,
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
        <div>
          <p className="mb-1.5 text-xs font-semibold text-content-muted">{L('payeAvec')}</p>
          <div className="flex flex-wrap gap-2">
            {SOURCES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setF((x) => ({ ...x, paymentSource: s, bankAccountId: '' }))}
                className={`rounded-xl border px-3 py-2 text-sm transition ${f.paymentSource === s ? 'border-primary bg-primary/10 font-semibold text-primary' : 'text-content-muted hover:border-primary/50'}`}
              >
                {L(`source_${s}`)}
              </button>
            ))}
          </div>
        </div>
        {f.paymentSource !== 'CASH' && (
          <Field label={f.paymentSource === 'BANK' ? L('compteDebite') : L('compteDebiteOptionnel')}>
            {usable.length === 0 ? <NoAccountHint /> : <AccountSelect accounts={usable} value={f.bankAccountId} onChange={set('bankAccountId')} />}
          </Field>
        )}
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
          <Field label={L('beneficiaire')}>
            <input className="input" placeholder={L('beneficiairePlaceholder')} value={f.payee} onChange={(e) => set('payee')(e.target.value)} />
          </Field>
          <Field label={L('referenceFacture')}>
            <input className="input" value={f.reference} onChange={(e) => set('reference')(e.target.value)} />
          </Field>
          <Field label={L('boutique')}>
            <BranchSelect value={f.branchId} onChange={set('branchId')} />
          </Field>
          <Field label="Note">
            <input className="input" value={f.notes} onChange={(e) => set('notes')(e.target.value)} />
          </Field>
        </div>
        <LinksEditor value={links} onChange={setLinks} />
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

function AccountModal({ account, onClose }: { account?: BankAccount; onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [f, setF] = useState({
    type: (account?.type ?? 'BANK') as (typeof ACCOUNT_TYPES)[number],
    provider: account?.provider ?? 'ORANGE_MONEY',
    phoneNumber: account?.phoneNumber ?? '',
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
  const isMobile = f.type === 'MOBILE_MONEY';
  const isBank = f.type === 'BANK';
  // Mobile money : le nom de l'opérateur sert de « banque ».
  const bankName = isMobile ? PROVIDER_LABEL[f.provider] ?? (f.bankName || 'Mobile money') : f.bankName;

  const mut = useMutation({
    mutationFn: () => {
      const input: BankAccountCreateInput = {
        type: f.type,
        provider: isMobile ? (f.provider as BankAccountCreateInput['provider']) : '',
        phoneNumber: isMobile ? f.phoneNumber : '',
        bankName: bankName.trim(),
        accountName: f.accountName.trim(),
        accountNumber: f.accountNumber,
        iban: isBank ? f.iban : '',
        swift: isBank ? f.swift : '',
        openingBalance: Number(f.openingBalance) || 0,
        notes: f.notes,
        active: f.active,
      };
      return account ? updateBankAccount(account.id, input) : createBankAccount(input);
    },
    onSuccess: () => {
      invalidateFinancialViews(qc);
      onClose();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });
  return (
    <Modal open onClose={onClose} title={account ? L('modifierLeCompte') : L('nouveauCompte')} size="md">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ACCOUNT_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set('type')(t)}
              className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-xs font-semibold transition ${f.type === t ? 'border-primary bg-primary/10 text-primary' : 'text-content-muted hover:border-primary/50'}`}
            >
              <AccountIcon account={{ type: t, provider: null }} className="h-5 w-5" />
              {L(`type_${t}`)}
            </button>
          ))}
        </div>
        {isMobile && (
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => set('provider')(p)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${f.provider === p ? 'border-primary bg-primary/10 text-primary' : 'text-content-muted hover:border-primary/50'}`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${PROVIDER_COLOR[p] ?? 'bg-content-faint'}`} />
                {PROVIDER_LABEL[p] ?? L('autreOperateur')}
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {!isMobile && (
            <Field label={isBank ? L('banque') : L('nomDuCompte')}>
              <input className="input" placeholder={isBank ? 'BGFIBank, UBA, Ecobank…' : L('coffrePlaceholder')} value={f.bankName} onChange={(e) => set('bankName')(e.target.value)} />
            </Field>
          )}
          {isMobile && f.provider === 'OTHER' && (
            <Field label={L('operateur')}>
              <input className="input" value={f.bankName} onChange={(e) => set('bankName')(e.target.value)} />
            </Field>
          )}
          <Field label={L('intitule')}>
            <input className="input" placeholder={L('intitulePlaceholder')} value={f.accountName} onChange={(e) => set('accountName')(e.target.value)} />
          </Field>
          {isMobile && (
            <Field label={L('numeroTelephone')}>
              <input className="input font-mono" type="tel" placeholder="+241 07 00 00 00" value={f.phoneNumber} onChange={(e) => set('phoneNumber')(e.target.value)} />
            </Field>
          )}
          {isBank && (
            <>
              <Field label={L('numeroDeCompte')}>
                <input className="input font-mono" value={f.accountNumber} onChange={(e) => set('accountNumber')(e.target.value)} />
              </Field>
              <Field label="IBAN / RIB">
                <input className="input font-mono" value={f.iban} onChange={(e) => set('iban')(e.target.value)} />
              </Field>
              <Field label="SWIFT / BIC">
                <input className="input font-mono" value={f.swift} onChange={(e) => set('swift')(e.target.value)} />
              </Field>
            </>
          )}
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
          <Button loading={mut.isPending} disabled={bankName.trim().length < 2 || f.accountName.trim().length < 2} onClick={() => mut.mutate()}>
            {L('enregistrer')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function StatementModal({ account, onClose }: { account: BankAccount; onClose: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['bank-statement', account.id], queryFn: () => getBankStatement(account.id) });
  const title = `${providerLabel(account.provider) ?? account.bankName} · ${account.accountName}`;
  return (
    <Modal open onClose={onClose} title={L('releveDe', { name: title })} size="lg">
      {isLoading || !data ? (
        <PageLoader />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 p-3 text-sm">
            <span className="text-content-muted">{L('soldeOuverture')} <b className="text-content">{formatCurrency(data.openingBalance)}</b></span>
            <span className="text-content-muted">{L('soldeActuel')} <b className="text-content">{formatCurrency(data.balance)}</b></span>
            <Button
              variant="outline"
              className="h-8 px-3 text-xs"
              disabled={data.lines.length === 0}
              onClick={() =>
                downloadCsv(
                  `releve-${account.accountName.replace(/\W+/g, '-')}.csv`,
                  [L('colDate'), L('operation'), L('colReference'), L('colTiers'), L('montant'), L('solde')],
                  data.lines.map((l) => [formatDate(l.date), l.label, l.reference ?? '', l.counterparty ?? '', l.signed, l.balance]),
                )
              }
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>
          {data.lines.length === 0 ? (
            <p className="text-sm text-content-muted">{L('aucunMouvement')}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-content-faint">
                    <th className="table-cell font-semibold">{L('colDate')}</th>
                    <th className="table-cell font-semibold">{L('operation')}</th>
                    <th className="table-cell text-right font-semibold">{L('montant')}</th>
                    <th className="table-cell text-right font-semibold">{L('solde')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((l) => (
                    <tr key={`${l.type}-${l.id}-${l.signed}`} className="border-b last:border-0">
                      <td className="table-cell whitespace-nowrap text-content-muted">{formatDate(l.date)}</td>
                      <td className="table-cell">
                        <div className="text-content">{l.label}</div>
                        <div className="text-xs text-content-faint">
                          {[l.type === 'EXPENSE' ? L('depense') : l.kind ? kindLabel(l.kind) : null, l.reference, l.counterparty].filter(Boolean).join(' · ')}
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
          <Button variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" /> {L('retour')}
          </Button>
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
