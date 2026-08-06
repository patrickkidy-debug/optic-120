import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { Glasses } from 'lucide-react';
import type { PrescriptionCreateInput } from '@oculo/shared-types';
import { lensBaseOptions, DEFAULT_LENS_PRICING } from '@oculo/shared-types';
import { createPrescription, type Prescription } from './api';
import { useAuthStore } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { Button, Field } from '../../components/ui';

/**
 * Saisie d'une ordonnance optique, rattachée à un client. Partagée par la
 * fiche client et la composition d'un devis : on peut enregistrer une
 * ordonnance sans quitter le devis quand le client n'en a pas encore.
 * `onSaved` reçoit l'ordonnance créée (utile pour la sélectionner aussitôt).
 */
export function PrescriptionForm({
  customerId,
  onClose,
  onSaved,
  title = 'Nouvelle ordonnance optique',
}: {
  customerId: string;
  onClose: () => void;
  onSaved: (rx: Prescription) => void;
  title?: string;
}) {
  const [error, setError] = useState('');
  const [lensOther, setLensOther] = useState(false);
  const pricing = useAuthStore((s) => s.user?.tenantLensPricing) ?? DEFAULT_LENS_PRICING;
  const { register, handleSubmit, setValue } = useForm<PrescriptionCreateInput>();
  const mut = useMutation({
    mutationFn: (v: PrescriptionCreateInput) => createPrescription(customerId, v),
    onSuccess: onSaved,
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const cell = 'input px-2 py-1.5 text-center text-sm';

  return (
    <form
      onSubmit={handleSubmit((v) => mut.mutate(v))}
      className="space-y-3 rounded-xl border border-primary/30 bg-primary-soft/40 p-4"
    >
      <h4 className="flex items-center gap-2 font-semibold text-content">
        <Glasses className="h-4 w-4 text-primary" /> {title}
      </h4>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs uppercase text-content-faint">
              <th className="px-1 pb-1 text-left font-semibold">Œil</th>
              <th className="px-1 pb-1 font-semibold">Sphère</th>
              <th className="px-1 pb-1 font-semibold">Cylindre</th>
              <th className="px-1 pb-1 font-semibold">Axe</th>
              <th className="px-1 pb-1 font-semibold">Addition</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="pr-2 font-semibold text-content">OD</td>
              <td className="px-1"><input className={cell} placeholder="+0.00" {...register('odSphere')} /></td>
              <td className="px-1"><input className={cell} placeholder="-0.00" {...register('odCylinder')} /></td>
              <td className="px-1"><input className={cell} placeholder="0°" {...register('odAxis')} /></td>
              <td className="px-1"><input className={cell} placeholder="+0.00" {...register('odAddition')} /></td>
            </tr>
            <tr>
              <td className="pr-2 font-semibold text-content">OG</td>
              <td className="px-1"><input className={cell} placeholder="+0.00" {...register('ogSphere')} /></td>
              <td className="px-1"><input className={cell} placeholder="-0.00" {...register('ogCylinder')} /></td>
              <td className="px-1"><input className={cell} placeholder="0°" {...register('ogAxis')} /></td>
              <td className="px-1"><input className={cell} placeholder="+0.00" {...register('ogAddition')} /></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Écart pupillaire (mm)"><input className="input" placeholder="62" {...register('pupillaryDistance')} /></Field>
        <Field label="Type de verres">
          {lensOther ? (
            <input className="input" placeholder="Préciser le type" autoFocus {...register('lensType')} />
          ) : (
            <select
              className="input"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value === '__other__') {
                  setLensOther(true);
                  setValue('lensType', '');
                } else setValue('lensType', e.target.value);
              }}
            >
              <option value="">— Choisir —</option>
              {lensBaseOptions(pricing).map((o) => (
                <option key={o.key} value={o.label}>{o.label}</option>
              ))}
              <option value="__other__">Autre…</option>
            </select>
          )}
        </Field>
        <Field label="Prescripteur"><input className="input" {...register('prescriberName')} /></Field>
      </div>

      {/* Mesures avancées de montage */}
      <details className="rounded-xl border border-line bg-surface-2/40 px-3 py-2">
        <summary className="cursor-pointer select-none text-sm font-semibold text-content-muted">
          Mesures avancées de montage (optionnel)
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Hauteur OD (mm)"><input className="input" placeholder="18" {...register('odHeight')} /></Field>
          <Field label="Hauteur OG (mm)"><input className="input" placeholder="18" {...register('ogHeight')} /></Field>
          <Field label="EP près OD (mm)"><input className="input" placeholder="29" {...register('odNearPd')} /></Field>
          <Field label="EP près OG (mm)"><input className="input" placeholder="29" {...register('ogNearPd')} /></Field>
          <Field label="Vertex (mm)"><input className="input" placeholder="12" {...register('vertex')} /></Field>
          <Field label="Angle pantoscopique (°)"><input className="input" placeholder="8" {...register('pantoTilt')} /></Field>
        </div>
      </details>

      <Field label="Notes"><input className="input" {...register('notes')} /></Field>

      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
        <Button type="submit" loading={mut.isPending}>Enregistrer l'ordonnance</Button>
      </div>
    </form>
  );
}
