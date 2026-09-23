import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { getFounderOverview } from '../../features/billing/console';
import { getPlatformStats, runBilling } from '../../features/billing/api';
import { apiErrorMessage } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { ConsoleLayout } from './console/ConsoleLayout';
import { ConsoleOverviewPage } from './console/OverviewPage';
import { ConsoleUsersPage } from './console/UsersPage';
import { ConsoleTenantsPage, TenantDetailModal as TenantModalPortal } from './console/TenantsPage';
import { ConsolePaymentsPage } from './console/PaymentsListPage';
import { GlobalSearch } from './console/GlobalSearch';
import { isSectionId, type SectionId } from './console/navigation';
import { BillingTab } from './billing/BillingTab';
import {
  DemosTab,
  EngagementTab,
  FinanceTab,
  NotificationBell,
  PartnersTab,
  PaymentsTab,
  PlansTab,
  StoreSetupTab,
  SupportTab,
  TeamTab,
} from './PlatformPage';
import { RenewalsTab } from './RenewalsTab';
import { AnnouncementsTab } from './AnnouncementsTab';

/**
 * Console fondateur — coquille et aiguillage.
 *
 * La page ne contient AUCUN écran : elle assemble la navigation, la recherche
 * et les liens entre sections. Les écrans restent dans leurs fichiers, et ceux
 * qui existaient déjà (Démos, Engagement, Partenaires, Support, Offres,
 * Configuration boutique, Équipe) sont réutilisés tels quels — la refonte porte
 * sur l'architecture, pas sur leur contenu.
 *
 * La section vit dans l'URL (`/plateforme/factures`) : un lien de console est
 * partageable, et un rechargement ne ramène pas à l'accueil. C'est ce que la
 * barre d'onglets précédente, purement locale, ne permettait pas.
 */
export function ConsolePage() {
  const navigate = useNavigate();
  const params = useParams<{ section?: string }>();
  const qc = useQueryClient();
  const toast = useToast();

  const section: SectionId = isSectionId(params.section) ? params.section : 'overview';

  const [searchOpen, setSearchOpen] = useState(false);
  const [tenantModalId, setTenantModalId] = useState<string | null>(null);
  const [billingInvoiceId, setBillingInvoiceId] = useState<string | null>(null);
  const [billingTenantId, setBillingTenantId] = useState<string | null>(null);

  // Les compteurs des pastilles viennent de la MÊME lecture que le tableau de
  // bord : le menu et l'accueil ne peuvent donc pas annoncer deux chiffres
  // différents pour « À confirmer ».
  const { data: overview } = useQuery({
    queryKey: ['platform-overview-nav'],
    queryFn: () => getFounderOverview({}),
    staleTime: 60_000,
  });

  // Les anciens écrans lisent encore `platform-stats` : on le garde chaud pour
  // qu'ils ne repartent pas de zéro à chaque changement de section.
  useQuery({ queryKey: ['platform-stats'], queryFn: getPlatformStats, staleTime: 60_000 });

  const billingMut = useMutation({
    mutationFn: runBilling,
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['console-users'] });
      void qc.invalidateQueries({ queryKey: ['console-tenants'] });
      void qc.invalidateQueries({ queryKey: ['platform-overview'] });
      void qc.invalidateQueries({ queryKey: ['platform-overview-nav'] });
      void qc.invalidateQueries({ queryKey: ['platform-stats'] });
      toast.success(
        `Cycle exécuté : ${r.markedPastDue} en retard, ${r.suspended} suspendu${r.suspended > 1 ? 's' : ''}.`,
      );
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const go = useCallback(
    (id: SectionId) => {
      navigate(id === 'overview' ? '/plateforme' : `/plateforme/${id}`);
    },
    [navigate],
  );

  /** Ouvre la facturation d'un client, quelle que soit la section d'origine. */
  const openBilling = useCallback(
    (tenantId: string) => {
      setBillingTenantId(tenantId);
      go('factures');
    },
    [go],
  );

  const openInvoice = useCallback(
    (invoiceId: string) => {
      setBillingInvoiceId(invoiceId);
      go('factures');
    },
    [go],
  );

  const clearDeepLink = useCallback(() => {
    setBillingInvoiceId(null);
    setBillingTenantId(null);
  }, []);

  return (
    <>
      <ConsoleLayout
        section={section}
        overview={overview}
        onNavigate={go}
        onOpenSearch={() => setSearchOpen(true)}
        onRunBillingCycle={() => billingMut.mutate()}
        billingCycleRunning={billingMut.isPending}
        notificationSlot={<NotificationBell />}
      >
        {section === 'overview' && <ConsoleOverviewPage onNavigate={go} />}

        {section === 'utilisateurs' && (
          <ConsoleUsersPage onOpenTenant={setTenantModalId} onOpenBilling={openBilling} />
        )}

        {section === 'etablissements' && (
          <ConsoleTenantsPage
            onOpenBilling={openBilling}
            openTenantId={tenantModalId}
            onOpenTenant={setTenantModalId}
            onCloseTenant={() => setTenantModalId(null)}
          />
        )}

        {section === 'demos' && <DemosTab />}
        {section === 'engagement' && <EngagementTab />}

        {section === 'abonnements' && (
          <BillingTab initialTab="subscriptions" onConsumeDeepLink={clearDeepLink} />
        )}
        {section === 'renouvellements' && <RenewalsTab />}
        {section === 'a-confirmer' && <PaymentsTab />}
        {section === 'offres' && <PlansTab />}

        {section === 'finances' && (
          <BillingTab initialTab="overview" onConsumeDeepLink={clearDeepLink} />
        )}
        {section === 'factures' && (
          <BillingTab
            initialTab="invoices"
            openInvoiceId={billingInvoiceId}
            openTenantId={billingTenantId}
            onConsumeDeepLink={clearDeepLink}
          />
        )}
        {section === 'paiements' && <ConsolePaymentsPage onOpenInvoice={openInvoice} />}
        {section === 'revenus' && <FinanceTab />}

        {section === 'configuration' && <StoreSetupTab />}
        {section === 'equipe' && <TeamTab />}
        {section === 'partenaires' && <PartnersTab />}
        {section === 'nouveautes' && <AnnouncementsTab />}

        {section === 'support' && <SupportTab />}

        {section === 'parametres' && (
          <BillingTab initialTab="settings" onConsumeDeepLink={clearDeepLink} />
        )}
      </ConsoleLayout>

      {/* La fiche établissement s'ouvre depuis n'importe quelle section. Hors de
          la page Établissements, elle est rendue ici, sinon elle disparaîtrait
          en changeant de section. */}
      {tenantModalId && section !== 'etablissements' && (
        <TenantModalPortal
          tenantId={tenantModalId}
          onClose={() => setTenantModalId(null)}
          onOpenBilling={openBilling}
        />
      )}

      {searchOpen && (
        <GlobalSearch
          onClose={() => setSearchOpen(false)}
          onPickTenant={setTenantModalId}
          onPickUser={(_userId, tenantId) => setTenantModalId(tenantId)}
          onPickInvoice={openInvoice}
        />
      )}
    </>
  );
}
