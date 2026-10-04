import { useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileText, Glasses, MapPin, StickyNote, UserRound } from 'lucide-react';
import { customerCreateSchema, type CustomerCreateInput } from '@oculo/shared-types';
import { createCustomer, updateCustomer, type Customer } from '../../../features/optique/api';
import { useUIStore } from '../../../store/ui';
import { usePermission } from '../../../store/auth';
import { apiErrorMessage } from '../../../lib/api';
import { useToast } from '../../../components/Toast';
import { Button, Modal } from '../../../components/ui';
import { tr } from '../../../lib/tr';

/**
 * Création / modification d'un client, en sections courtes plutôt qu'un long
 * formulaire. Les erreurs s'affichent sous chaque champ. Après une création,
 * la fenêtre propose la suite logique : ordonnance ou devis.
 */
export function CustomerFormModal({
  customer,
  onClose,
  onAddPrescription,
  onCreateQuote,
}: {
  customer: Customer | null;
  onClose: () => void;
  /** Après création : ouvrir le dossier sur l'ajout d'ordonnance. */
  onAddPrescription?: (c: Customer) => void;
  /** Après création : ouvrir la caisse en devis pour ce client. */
  onCreateQuote?: (c: Customer) => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const branchId = useUIStore((st) => st.activeBranchId);
  const canRx = usePermission('optique.prescriptions.create');
  const canQuote = usePermission('optique.quotes.create');
  const [error, setError] = useState('');
  const [created, setCreated] = useState<Customer | null>(null);

  // Messages lisibles (le schéma partagé garde ses règles, on précise le texte).
  const schema = useMemo(
    () =>
      customerCreateSchema.extend({
        firstName: z.string().trim().min(1, tr('crm.errFirstName')).max(80),
        lastName: z.string().trim().min(1, tr('crm.errLastName')).max(80),
        phone: z
          .string()
          .max(40)
          .optional()
          .refine((v) => !v || v.replace(/\D/g, '').length >= 6, tr('crm.errPhone')),
        email: z.string().email(tr('crm.errEmail')).optional().or(z.literal('')),
      }),
    [],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerCreateInput>({
    resolver: zodResolver(schema),
    defaultValues: customer
      ? {
          firstName: customer.firstName,
          lastName: customer.lastName,
          phone: customer.phone ?? '',
          email: customer.email ?? '',
          dateOfBirth: customer.dateOfBirth ? customer.dateOfBirth.slice(0, 10) : '',
          gender: (customer.gender as CustomerCreateInput['gender']) ?? '',
          address: customer.address ?? '',
          profession: customer.profession ?? '',
          notes: customer.notes ?? '',
        }
      : {},
  });

  const mut = useMutation({
    mutationFn: (v: CustomerCreateInput) => {
      if (customer) return updateCustomer(customer.id, v);
      if (!branchId) throw new Error(tr('ui.ClientsPage.selectionnezUnMagasinAvantDe'));
      return createCustomer(v, branchId) as Promise<Customer>;
    },
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: ['customers'] });
      void qc.invalidateQueries({ queryKey: ['customer-directory'] });
      if (customer) {
        void qc.invalidateQueries({ queryKey: ['customer', customer.id] });
        toast.success(tr('crm.toastUpdated'));
        onClose();
      } else {
        toast.success(tr('crm.toastCreated'));
        setCreated(c);
      }
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const err = (name: keyof CustomerCreateInput) =>
    errors[name]?.message ? <p className="mt-1 text-xs text-danger">{String(errors[name]?.message)}</p> : null;

  if (created) {
    return (
      <Modal open onClose={onClose} title={tr('crm.newClient')} size="sm">
        <div className="py-2 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
          <p className="mt-3 font-display text-lg font-bold text-content">{tr('crm.toastCreated')}</p>
          <p className="mt-1 text-sm text-content-muted">
            {created.firstName} {created.lastName} — {tr('crm.nextStep')}
          </p>
          <div className="mt-5 grid gap-2">
            {canRx && onAddPrescription && (
              <Button onClick={() => onAddPrescription(created)}>
                <Glasses className="h-4 w-4" /> {tr('crm.addPrescription')}
              </Button>
            )}
            {canQuote && onCreateQuote && (
              <Button variant="outline" onClick={() => onCreateQuote(created)}>
                <FileText className="h-4 w-4" /> {tr('crm.createQuote')}
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              {tr('crm.later')}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={customer ? tr('crm.editClient') : tr('crm.newClient')} size="lg">
      <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-5" noValidate>
        <Section icon={UserRound} title={tr('crm.secPersonal')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Label text={tr('crm.firstName')} required>
              <input className="input" autoFocus {...register('firstName')} />
              {err('firstName')}
            </Label>
            <Label text={tr('crm.lastName')} required>
              <input className="input" {...register('lastName')} />
              {err('lastName')}
            </Label>
            <Label text={tr('crm.phone')} hint={tr('crm.phoneHint')}>
              <input className="input" type="tel" inputMode="tel" placeholder="+221 77 123 45 67" {...register('phone')} />
              {err('phone')}
            </Label>
            <Label text="Email">
              <input className="input" type="email" placeholder="nom@exemple.com" {...register('email')} />
              {err('email')}
            </Label>
            <Label text={tr('crm.birthDate')}>
              <input className="input" type="date" {...register('dateOfBirth')} />
            </Label>
            <Label text={tr('crm.gender')}>
              <select className="input" {...register('gender')}>
                <option value="">{tr('ui.ClientsPage.nonPrecise')}</option>
                <option value="MALE">{tr('ui.ClientsPage.masculin')}</option>
                <option value="FEMALE">{tr('ui.ClientsPage.feminin')}</option>
                <option value="OTHER">{tr('ui.ClientsPage.autre')}</option>
              </select>
            </Label>
          </div>
        </Section>

        <Section icon={MapPin} title={tr('crm.secMore')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Label text={tr('crm.profession')} hint={tr('crm.professionHint')}>
              <input className="input" placeholder={tr('ui.ClientsPage.enseignantChauffeur')} {...register('profession')} />
            </Label>
            <Label text={tr('crm.address')}>
              <input className="input" placeholder={tr('ui.ClientsPage.quartierVille')} {...register('address')} />
            </Label>
          </div>
        </Section>

        {!customer && canRx && (
          <Section icon={Glasses} title={tr('crm.secOptical')}>
            <p className="text-sm text-content-muted">{tr('crm.opticalHint')}</p>
          </Section>
        )}

        <Section icon={StickyNote} title={tr('crm.secNotes')}>
          <textarea
            className="input min-h-[80px]"
            placeholder={tr('ui.ClientsPage.antecedentsPreferencesDeMontureRemarques')}
            {...register('notes')}
          />
        </Section>

        {error && <p className="rounded-lg bg-[color:var(--danger)]/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            {tr('ui.ClientsPage.annuler')}
          </Button>
          <Button type="submit" loading={mut.isPending}>
            {customer ? tr('ui.ClientsPage.enregistrer') : tr('crm.createClient')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof UserRound; title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-content-faint">
        <Icon className="h-3.5 w-3.5 text-primary" /> {title}
      </h3>
      {children}
    </section>
  );
}

function Label({ text, hint, required, children }: { text: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">
        {text}
        {required && <span className="ml-0.5 text-danger">*</span>}
        {hint && <span className="ml-1.5 font-normal text-content-faint">· {hint}</span>}
      </span>
      {children}
    </label>
  );
}
