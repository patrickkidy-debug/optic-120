import { useState } from 'react';
import { Plus } from 'lucide-react';
import { usePermission } from '../../store/auth';
import { PageHeader, Button } from '../../components/ui';
import { TabBar } from './shared';
import { OverviewTab } from './OverviewTab';
import { AnomaliesListTab } from './AnomaliesListTab';
import { JournalTab } from './JournalTab';
import { DeclareModal } from './DeclareModal';
import { DetailModal } from './DetailModal';

type Tab = 'overview' | 'list' | 'journal';

const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Tableau de bord' },
  { value: 'list', label: 'Anomalies' },
  { value: 'journal', label: "Journal d'activité" },
];

export function AnomaliesPage() {
  const canDeclare = usePermission('anomalies.declare');
  const canSeeJournal = usePermission('anomalies.journal');
  const [tab, setTab] = useState<Tab>('overview');
  const [declaring, setDeclaring] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const visibleTabs = TABS.filter((t) => t.value !== 'journal' || canSeeJournal);

  return (
    <div>
      <PageHeader
        title="Anomalies & corrections"
        subtitle="Déclaration, validation et correction tracée des erreurs métier"
        actions={
          canDeclare && (
            <Button onClick={() => setDeclaring(true)}>
              <Plus className="h-4 w-4" /> Déclarer une anomalie
            </Button>
          )
        }
      />

      <TabBar tabs={visibleTabs} value={tab} onChange={setTab} />

      {tab === 'overview' ? (
        <OverviewTab />
      ) : tab === 'list' ? (
        <AnomaliesListTab onOpen={setOpenId} />
      ) : (
        <JournalTab />
      )}

      {declaring && <DeclareModal onClose={() => setDeclaring(false)} />}
      {openId && <DetailModal anomalyId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
