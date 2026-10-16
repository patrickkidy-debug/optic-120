import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, Archive, CheckCircle2, Info } from 'lucide-react';
import { Button, Modal, PageLoader } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { apiErrorMessage } from '../../lib/api';
import { tr } from '../../lib/tr';
import { listUsers } from '../rbac/api';
import { TeamPicker } from './BranchFormPanel';
import { archiveBranch, archiveCheck, setBranchTeam } from './api';

/** Affectation des collaborateurs à un magasin (rôles existants inchangés). */
export function BranchTeamModal({
  branch,
  onClose,
  onSaved,
}: {
  branch: { id: string; name: string; managerId: string | null };
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: listUsers });
  const [selected, setSelected] = useState<string[] | null>(null);
  const [error, setError] = useState('');

  // Sélection initiale : collaborateurs actuellement affectés (hors rôles « tous magasins »).
  useEffect(() => {
    if (users && selected === null) {
      setSelected(users.filter((u) => !u.role.allBranches && u.branches.some((b) => b.id === branch.id)).map((u) => u.id));
    }
  }, [users, selected, branch.id]);

  const initial = users?.filter((u) => !u.role.allBranches && u.branches.some((b) => b.id === branch.id)).map((u) => u.id) ?? [];
  const dirty = selected !== null && JSON.stringify([...selected].sort()) !== JSON.stringify([...initial].sort());

  const mut = useMutation({
    mutationFn: () => {
      const ids = new Set(selected ?? []);
      if (branch.managerId) ids.add(branch.managerId);
      return setBranchTeam(branch.id, [...ids]);
    },
    onSuccess: (r) => {
      toast.success(tr('br.team.saved', { added: r.added, removed: r.removed }));
      onSaved();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const close = () => {
    if (dirty && !confirm(tr('br.form.discard'))) return;
    onClose();
  };

  return (
    <Modal open onClose={close} title={tr('br.team.title', { name: branch.name })} size="md">
      {isLoading || selected === null ? (
        <PageLoader />
      ) : (
        <div className="space-y-4">
          <p className="flex gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-content-muted">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {tr('br.team.hint')}
          </p>
          <TeamPicker users={(users ?? []).filter((u) => u.isActive)} value={selected} onChange={setSelected} managerId={branch.managerId ?? undefined} />
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>{tr('br.cancel')}</Button>
            <Button onClick={() => mut.mutate()} loading={mut.isPending} disabled={!dirty}>{tr('br.save')}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/**
 * Archivage : le serveur liste les blocages (transferts en cours, caisse
 * ouverte, stock restant…) et les conséquences à connaître avant de confirmer.
 */
export function ArchiveBranchDialog({ branch, onClose, onDone }: { branch: { id: string; name: string }; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const check = useQuery({ queryKey: ['branch-archive-check', branch.id], queryFn: () => archiveCheck(branch.id), staleTime: 0 });
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => archiveBranch(branch.id),
    onSuccess: () => {
      toast.success(tr('br.archive.done', { name: branch.name }));
      onDone();
    },
    onError: (e) => {
      setError(apiErrorMessage(e));
      void check.refetch();
    },
  });
  const issue = (i: { code: string; params?: Record<string, string | number> }) => tr(`br.archive.${i.code}`, i.params);

  return (
    <Modal open onClose={onClose} title={tr('br.archive.title', { name: branch.name })} size="md">
      {check.isLoading ? (
        <PageLoader />
      ) : check.isError ? (
        <p className="text-sm text-danger">{apiErrorMessage(check.error)}</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-content-muted">{tr('br.archive.explain')}</p>
          {check.data!.blockers.length > 0 && (
            <div className="rounded-xl border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10 p-3">
              <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-danger">
                <AlertTriangle className="h-4 w-4" /> {tr('br.archive.blocked')}
              </p>
              <ul className="list-disc space-y-1 pl-6 text-sm text-content">
                {check.data!.blockers.map((b) => <li key={b.code}>{issue(b)}</li>)}
              </ul>
            </div>
          )}
          {check.data!.warnings.length > 0 && (
            <div className="rounded-xl border border-[color:var(--warning)]/30 bg-[color:var(--warning)]/10 p-3">
              <p className="mb-1.5 text-sm font-semibold text-warning">{tr('br.archive.warnings')}</p>
              <ul className="list-disc space-y-1 pl-6 text-sm text-content">
                {check.data!.warnings.map((w) => <li key={w.code}>{issue(w)}</li>)}
              </ul>
            </div>
          )}
          {check.data!.canArchive && check.data!.warnings.length === 0 && (
            <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-4 w-4" /> {tr('br.archive.ready')}</p>
          )}
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>{tr('br.cancel')}</Button>
            <Button variant="danger" onClick={() => mut.mutate()} loading={mut.isPending} disabled={!check.data!.canArchive}>
              <Archive className="h-4 w-4" /> {tr('br.archive.confirm')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
