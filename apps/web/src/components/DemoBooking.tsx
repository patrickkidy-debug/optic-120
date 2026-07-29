import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Sparkles, CheckCircle2, PartyPopper } from 'lucide-react';
import { getPlanStatus, getMyDemoRequest, bookDemo } from '../features/billing/api';
import { useAuthStore } from '../store/auth';
import { apiErrorMessage } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { Modal, Button, Field } from './ui';

const DEMO_STATUS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: 'En attente de confirmation', tone: 'text-warning' },
  CONFIRMED: { label: 'Confirmée', tone: 'text-success' },
  DONE: { label: 'Réalisée', tone: 'text-content-muted' },
  CANCELLED: { label: 'Annulée', tone: 'text-danger' },
};

/** Valeur par défaut du champ datetime-local : demain 10 h, heure locale. */
function defaultSlot(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Bannière tableau de bord : propose une démonstration gratuite aux
 * établissements en essai ou sans abonnement actif. Masquée dès que
 * l'abonnement est actif.
 */
export function DemoBooking() {
  const [open, setOpen] = useState(false);
  const { data: plan } = useQuery({ queryKey: ['plan-status'], queryFn: getPlanStatus });
  const { data: mine } = useQuery({ queryKey: ['demo-mine'], queryFn: getMyDemoRequest });

  // Abonnement actif → pas de proposition de démo.
  if (plan && plan.status === 'ACTIVE') return null;

  const active = mine && (mine.status === 'PENDING' || mine.status === 'CONFIRMED');
  const st = mine ? DEMO_STATUS[mine.status] : null;

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-accent/5 to-transparent p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <p className="font-display font-bold text-content">Démonstration gratuite</p>
          {active && mine ? (
            <p className="mt-0.5 text-sm text-content-muted">
              Rendez-vous le <b className="text-content">{formatDateTime(mine.preferredAt)}</b> —{' '}
              <span className={st?.tone}>{st?.label}</span>
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-content-muted">
              Découvrez toutes les fonctionnalités avec un expert. Choisissez votre créneau, c'est offert.
            </p>
          )}
        </div>
      </div>
      <Button variant={active ? 'outline' : 'accent'} className="shrink-0" onClick={() => setOpen(true)}>
        <CalendarClock className="h-4 w-4" /> {active ? 'Choisir un autre créneau' : 'Réserver une démo'}
      </Button>

      {open && <DemoModal onClose={() => setOpen(false)} />}
    </div>
  );
}

function DemoModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [contactName, setContactName] = useState(
    user ? `${user.firstName} ${user.lastName}`.trim() : '',
  );
  const [contactEmail, setContactEmail] = useState(user?.email ?? '');
  const [contactPhone, setContactPhone] = useState(user?.tenantContactPhone ?? '');
  const [preferredAt, setPreferredAt] = useState(defaultSlot());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const mut = useMutation({
    mutationFn: () =>
      bookDemo({
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim() || undefined,
        // datetime-local (heure locale) → ISO UTC pour le serveur.
        preferredAt: new Date(preferredAt).toISOString(),
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['demo-mine'] });
      setDone(true);
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal open onClose={onClose} title="Réserver une démonstration gratuite" size="sm">
      {done ? (
        <div className="py-6 text-center">
          <PartyPopper className="mx-auto h-12 w-12 text-success" />
          <p className="mt-3 font-display text-lg font-bold text-content">Demande envoyée !</p>
          <p className="mt-1 text-sm text-content-muted">
            Nous vous contacterons pour confirmer le créneau du <b>{formatDateTime(preferredAt)}</b>.
          </p>
          <Button className="mt-5 w-full" onClick={onClose}>
            <CheckCircle2 className="h-4 w-4" /> Terminé
          </Button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            if (!contactName.trim() || !contactEmail.includes('@')) {
              setError('Nom et email valides requis.');
              return;
            }
            mut.mutate();
          }}
          className="space-y-3"
        >
          <Field label="Votre nom">
            <input className="input" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Email">
              <input type="email" className="input" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </Field>
            <Field label="Téléphone / WhatsApp">
              <input className="input" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+225…" />
            </Field>
          </div>
          <Field label="Créneau souhaité">
            <input
              type="datetime-local"
              className="input"
              value={preferredAt}
              min={defaultSlot().slice(0, 10) + 'T00:00'}
              onChange={(e) => setPreferredAt(e.target.value)}
            />
          </Field>
          <Field label="Message (optionnel)">
            <textarea
              className="input min-h-[60px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Vos besoins, questions, nombre de magasins…"
            />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" variant="accent" loading={mut.isPending}>
              <CalendarClock className="h-4 w-4" /> Réserver
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
