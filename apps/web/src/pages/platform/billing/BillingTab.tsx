import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BellRing, FileText, LayoutDashboard, Repeat, Settings, Wallet } from 'lucide-react';
import type { InvoiceMessageKind } from '@oculo/shared-types';
import type { Invoice } from '../../../features/billing/invoicing';
import { BillingOverviewTab } from './OverviewTab';
import { BillingInvoicesTab } from './InvoicesTab';
import { BillingSubscriptionsTab } from './SubscriptionsTab';
import { BillingRemindersTab } from './RemindersTab';
import { BillingSettingsTab } from './SettingsTab';
import { InvoiceDetailModal } from './InvoiceDetailModal';
import { NewInvoiceModal } from './NewInvoiceModal';
import { PaymentModal } from './PaymentModal';
import { RefundModal } from './RefundModal';
import { WhatsappModal } from './WhatsappModal';

const SUB_TABS = [
  { id: 'overview', label: "Vue d'ensemble", icon: LayoutDashboard },
  { id: 'invoices', label: 'Factures', icon: FileText },
  { id: 'subscriptions', label: 'Abonnements', icon: Repeat },
  { id: 'reminders', label: 'Relances', icon: BellRing },
  { id: 'settings', label: 'Paramètres', icon: Settings },
] as const;

type SubTab = (typeof SUB_TABS)[number]['id'];

/**
 * Module de facturation de la console fondateur (§3).
 *
 * Les modales sont pilotées ICI plutôt que dans chaque onglet : le même
 * encaissement, le même remboursement et le même envoi WhatsApp servent la
 * liste, la fiche et les relances. Dupliquer ces écrans par onglet aurait
 * garanti qu'ils divergent.
 */
export function BillingTab() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<SubTab>('overview');
  const [refreshToken, setRefreshToken] = useState(0);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [refunding, setRefunding] = useState<Invoice | null>(null);
  const [sending, setSending] = useState<{ invoice: Invoice; kind: InvoiceMessageKind } | null>(null);

  /**
   * Un mouvement d'argent touche la liste, les indicateurs, les relances ET la
   * fiche ouverte. Une seule fonction les rafraîchit toutes, pour qu'aucun
   * écran ne puisse rester sur un chiffre périmé après un encaissement.
   */
  function refreshAll() {
    setRefreshToken((t) => t + 1);
    for (const key of [
      'platform-billing-overview',
      'platform-billing-invoices',
      'platform-billing-invoice',
      'platform-billing-subscriptions',
      'platform-billing-reminders',
      'platform-billing-clients',
      // Les écrans historiques de la console lisent les mêmes factures.
      'platform-finance-summary',
      'platform-finance-invoices',
      'platform-finance-revenue',
      'platform-subs',
      'platform-stats',
    ]) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-1.5 border-b pb-3">
        {SUB_TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                tab === t.id
                  ? 'bg-primary text-white'
                  : 'bg-surface-2 text-content-muted hover:bg-surface-3 hover:text-content'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && (
        <BillingOverviewTab
          onCreateInvoice={() => setCreating(true)}
          onSendInvoice={() => setTab('invoices')}
        />
      )}

      {tab === 'invoices' && (
        <BillingInvoicesTab
          refreshToken={refreshToken}
          onOpen={(i) => setDetailId(i.id)}
          onCreate={() => setCreating(true)}
          onRecordPayment={setPaying}
          onRefund={setRefunding}
          onSendWhatsapp={(i) => setSending({ invoice: i, kind: 'invoice' })}
        />
      )}

      {tab === 'subscriptions' && <BillingSubscriptionsTab />}

      {tab === 'reminders' && (
        <BillingRemindersTab onSend={(invoice, kind) => setSending({ invoice, kind })} />
      )}

      {tab === 'settings' && <BillingSettingsTab />}

      {detailId && (
        <InvoiceDetailModal
          invoiceId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={refreshAll}
          onRecordPayment={setPaying}
          onRefund={setRefunding}
          onSendWhatsapp={(i) => setSending({ invoice: i, kind: 'invoice' })}
        />
      )}

      {creating && (
        <NewInvoiceModal
          onClose={() => setCreating(false)}
          onCreated={(invoice) => {
            setCreating(false);
            refreshAll();
            setDetailId(invoice.id);
            // La facture vient d'être émise : l'envoyer est le geste suivant
            // attendu (§32), donc la modale WhatsApp s'ouvre dans la foulée.
            setSending({ invoice, kind: 'invoice' });
          }}
        />
      )}

      {paying && (
        <PaymentModal
          invoice={paying}
          onClose={() => setPaying(null)}
          onSaved={(invoice) => {
            setPaying(null);
            refreshAll();
            setDetailId(invoice.id);
          }}
        />
      )}

      {refunding && (
        <RefundModal
          invoice={refunding}
          onClose={() => setRefunding(null)}
          onSaved={(invoice) => {
            setRefunding(null);
            refreshAll();
            setDetailId(invoice.id);
          }}
        />
      )}

      {sending && (
        <WhatsappModal
          invoice={sending.invoice}
          kind={sending.kind}
          onClose={() => {
            setSending(null);
            refreshAll();
          }}
        />
      )}
    </div>
  );
}
