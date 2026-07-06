import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Scissors,
  ClipboardCheck,
  HeartPulse,
  Pill,
  Plus,
  CalendarPlus,
  Stethoscope,
  Inbox,
  type LucideIcon,
} from 'lucide-react';
import {
  listPatients,
  listSurgeries,
  listConsultations,
  listAppointments,
  type Surgery,
  type Patient,
} from '../../features/clinic/api';
import { usePermission } from '../../store/auth';
import { formatDate, formatDateTime } from '../../lib/format';
import { PageHeader, Button, Badge, PageLoader } from '../../components/ui';
import { PatientRecord } from './PatientRecord';

const STAT_TONES: Record<string, string> = {
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/10 text-accent',
  warning: 'bg-warning/15 text-warning',
  success: 'bg-success/15 text-success',
  info: 'bg-sky-500/10 text-sky-500',
};

function StatCard({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: number; tone: keyof typeof STAT_TONES }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${STAT_TONES[tone]}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <div className="font-display text-2xl font-bold leading-none text-content">{value}</div>
        <div className="mt-1 text-xs text-content-muted">{label}</div>
      </div>
    </div>
  );
}

function Panel({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className="card flex min-h-[280px] flex-col p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="font-display font-bold text-content">{title}</h3>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="grid h-full min-h-[180px] place-items-center text-center">
      <div>
        <Inbox className="mx-auto h-8 w-8 text-content-faint" />
        <p className="mt-2 text-sm text-content-muted">{text}</p>
      </div>
    </div>
  );
}

export function ClinicDashboardPage() {
  const navigate = useNavigate();
  const canPatients = usePermission('clinic.patients.view');
  const canSurgery = usePermission('clinic.surgeries.view');
  const [openPatient, setOpenPatient] = useState<string | null>(null);

  const { data: patients, isLoading: lp } = useQuery({ queryKey: ['patients'], queryFn: () => listPatients() });
  const { data: surgeries, isLoading: ls } = useQuery({ queryKey: ['surgeries'], queryFn: () => listSurgeries() });
  const { data: consultations } = useQuery({ queryKey: ['consultations'], queryFn: () => listConsultations() });
  const { data: appointments } = useQuery({ queryKey: ['appointments'], queryFn: () => listAppointments() });

  if (lp || ls) return <PageLoader />;

  const patientsList = patients ?? [];
  const surgeriesList = surgeries ?? [];
  const consultsList = consultations ?? [];
  const apptList = appointments ?? [];

  const planned = surgeriesList.filter((s) => s.status === 'PLANNED');
  const done = surgeriesList.filter((s) => s.status === 'DONE');
  const rxCount = consultsList.filter((c) => (c.prescription ?? '').trim().length > 0).length;
  const upcomingAppts = apptList.filter(
    (a) => new Date(a.scheduledAt) >= new Date() && a.status !== 'CANCELLED',
  ).length;

  const recentPatients = [...patientsList]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);
  const activeSurgeries = [...planned].sort(
    (a, b) => new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime(),
  );

  return (
    <div>
      <PageHeader
        title="Tableau de bord clinique"
        subtitle="Patients, chirurgies, ordonnances et suivi ophtalmologique"
        actions={
          <div className="flex flex-wrap gap-2">
            {canPatients && (
              <Button variant="outline" onClick={() => navigate('/clinique/patients')}>
                <Plus className="h-4 w-4" /> Nouveau patient
              </Button>
            )}
            {canSurgery && (
              <Button onClick={() => navigate('/clinique/chirurgies')}>
                <CalendarPlus className="h-4 w-4" /> Planifier une chirurgie
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard icon={Users} label="Patients" value={patientsList.length} tone="primary" />
        <StatCard icon={Scissors} label="Chirurgies" value={surgeriesList.length} tone="accent" />
        <StatCard icon={ClipboardCheck} label="Pré-op (planifiées)" value={planned.length} tone="warning" />
        <StatCard icon={HeartPulse} label="Post-op (à suivre)" value={done.length} tone="success" />
        <StatCard icon={Pill} label="Ordonnances" value={rxCount} tone="info" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel icon={Stethoscope} title={`Chirurgies à venir (${activeSurgeries.length})`}>
          {activeSurgeries.length === 0 ? (
            <EmptyPanel text="Aucune chirurgie planifiée." />
          ) : (
            <div className="space-y-2">
              {activeSurgeries.slice(0, 8).map((s: Surgery) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-content">
                      {s.patient ? `${s.patient.firstName} ${s.patient.lastName}` : 'Patient'}
                    </p>
                    <p className="text-xs text-content-muted">
                      {s.type} ({s.eye}){s.scheduledAt ? ` · ${formatDateTime(s.scheduledAt)}` : ''}
                    </p>
                  </div>
                  <Badge tone="warning">Planifiée</Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel icon={Users} title="Dossiers patients récents">
          {recentPatients.length === 0 ? (
            <EmptyPanel text="Aucun patient enregistré." />
          ) : (
            <div className="space-y-2">
              {recentPatients.map((p: Patient) => (
                <button
                  key={p.id}
                  onClick={() => setOpenPatient(p.id)}
                  className="flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm transition hover:border-primary hover:bg-surface-2/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-content">
                      {p.firstName} {p.lastName}
                    </p>
                    <p className="text-xs text-content-muted">
                      {p.dateOfBirth ? `Né(e) le ${formatDate(p.dateOfBirth)}` : p.phone ?? '—'}
                    </p>
                  </div>
                  <span className="text-xs text-primary">Ouvrir</span>
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {openPatient && <PatientRecord patientId={openPatient} onClose={() => setOpenPatient(null)} />}
    </div>
  );
}
