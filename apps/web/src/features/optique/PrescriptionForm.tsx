import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { Glasses, ImagePlus, Trash2, Eye, Loader2 } from 'lucide-react';
import type { PrescriptionCreateInput } from '@oculo/shared-types';
import { lensBaseOptions, DEFAULT_LENS_PRICING } from '@oculo/shared-types';
import { createPrescription, updatePrescription, type Prescription } from './api';
import { useAuthStore } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { fileToResizedDataUrl, uploadImageToSupabase } from '../../lib/image';
import { Button, Field, Modal } from '../../components/ui';
import { tr } from '../../lib/tr';

/**
 * Saisie d'une ordonnance optique, rattachée à un client. Partagée par la
 * fiche client et la composition d'un devis : on peut enregistrer une
 * ordonnance sans quitter le devis quand le client n'en a pas encore.
 * `onSaved` reçoit l'ordonnance créée (utile pour la sélectionner aussitôt).
 */
export function PrescriptionForm({
  customerId,
  prescription,
  onClose,
  onSaved,
  title,
}: {
  customerId: string;
  /** Ordonnance existante à modifier. Absent = création d'une nouvelle ordonnance. */
  prescription?: Prescription;
  onClose: () => void;
  onSaved: (rx: Prescription) => void;
  title?: string;
}) {
  const isEdit = Boolean(prescription);
  const [error, setError] = useState('');
  const pricing = useAuthStore((s) => s.user?.tenantLensPricing) ?? DEFAULT_LENS_PRICING;
  const [lensOther, setLensOther] = useState(
    () => Boolean(prescription?.lensType) && !lensBaseOptions(pricing).some((o) => o.label === prescription!.lensType),
  );
  const [photoUrl, setPhotoUrl] = useState<string>(prescription?.photoUrl ?? '');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [zoomPhoto, setZoomPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, setValue } = useForm<PrescriptionCreateInput>({
    defaultValues: prescription
      ? {
          odSphere: prescription.odSphere ?? undefined,
          odCylinder: prescription.odCylinder ?? undefined,
          odAxis: prescription.odAxis ?? undefined,
          odAddition: prescription.odAddition ?? undefined,
          ogSphere: prescription.ogSphere ?? undefined,
          ogCylinder: prescription.ogCylinder ?? undefined,
          ogAxis: prescription.ogAxis ?? undefined,
          ogAddition: prescription.ogAddition ?? undefined,
          pupillaryDistance: prescription.pupillaryDistance ?? undefined,
          lensType: prescription.lensType ?? undefined,
          prescriberName: prescription.prescriberName ?? undefined,
          odHeight: prescription.odHeight ?? undefined,
          ogHeight: prescription.ogHeight ?? undefined,
          odNearPd: prescription.odNearPd ?? undefined,
          ogNearPd: prescription.ogNearPd ?? undefined,
          vertex: prescription.vertex ?? undefined,
          pantoTilt: prescription.pantoTilt ?? undefined,
          notes: prescription.notes ?? undefined,
        }
      : undefined,
  });
  const mut = useMutation({
    mutationFn: (v: PrescriptionCreateInput) =>
      isEdit
        ? updatePrescription(customerId, prescription!.id, { ...v, photoUrl: photoUrl || undefined })
        : createPrescription(customerId, { ...v, photoUrl: photoUrl || undefined }),
    onSuccess: onSaved,
    onError: (e) => setError(apiErrorMessage(e)),
  });

  async function handleFileSelected(file: File) {
    setUploadBusy(true);
    setError('');
    try {
      // 1024px max dimension, max 600KB output, upload vers Supabase Storage (bucket OCL 4)
      const url = await uploadImageToSupabase(file, 'ordonnances', 1024, 600 * 1024);
      setPhotoUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('ui.PrescriptionForm.erreurLorsDuTraitementDe'));
    } finally {
      setUploadBusy(false);
    }
  }

  const cell = 'input px-2 py-1.5 text-center text-sm';

  return (
    <form
      onSubmit={handleSubmit((v) => mut.mutate(v))}
      className="space-y-3 rounded-xl border border-primary/30 bg-primary-soft/40 p-4"
    >
      <h4 className="flex items-center gap-2 font-semibold text-content">
        <Glasses className="h-4 w-4 text-primary" />{' '}
        {title ?? (isEdit ? tr('ui.PrescriptionForm.modifierLOrdonnanceOptique') : tr('ui.PrescriptionForm.nouvelleOrdonnanceOptique'))}
      </h4>

      {/* Upload Scan / Photo de l'ordonnance papier */}
      <div className="rounded-xl border border-dashed border-primary/40 bg-surface/80 p-3">
        <p className="mb-2 text-xs font-semibold text-content">
          {tr('ui.PrescriptionForm.scanPhotoDeLOrdonnance')}
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFileSelected(file);
            e.target.value = '';
          }}
        />

        {photoUrl ? (
          <div className="flex items-center gap-3">
            <div className="group relative h-20 w-28 overflow-hidden rounded-lg border bg-surface-2">
              <img src={photoUrl} alt={tr('ui.PrescriptionForm.ordonnancePapier')} className="h-full w-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/40 opacity-0 transition group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => setZoomPhoto(true)}
                  className="rounded bg-white/90 p-1 text-slate-900"
                  title={tr('ui.PrescriptionForm.agrandir')}
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoUrl('')}
                  className="rounded bg-white/90 p-1 text-danger"
                  title={tr('ui.PrescriptionForm.supprimer')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <span className="badge bg-success/10 text-xs font-medium text-success">
                {tr('ui.PrescriptionForm.photoDOrdonnanceJointe')}
              </span>
              <p className="text-xs text-content-faint">
                {tr('ui.PrescriptionForm.lImageEstEnregistreeAvec')}
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-primary underline hover:text-primary-hover"
              >
                {tr('ui.PrescriptionForm.remplacerLImage')}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadBusy}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface-2/60 p-3 text-xs font-medium text-content-muted transition hover:border-primary hover:text-primary"
          >
            {uploadBusy ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <ImagePlus className="h-4 w-4 text-primary" />
            )}
            <span>
              {uploadBusy
                ? tr('ui.PrescriptionForm.traitementDeLaPhoto')
                : tr('ui.PrescriptionForm.ajouterUnePhotoOuScan')}
            </span>
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs uppercase text-content-faint">
              <th className="px-1 pb-1 text-left font-semibold">Œil</th>
              <th className="px-1 pb-1 font-semibold">{tr('ui.PrescriptionForm.sphere')}</th>
              <th className="px-1 pb-1 font-semibold">{tr('ui.PrescriptionForm.cylindre')}</th>
              <th className="px-1 pb-1 font-semibold">{tr('ui.PrescriptionForm.axe')}</th>
              <th className="px-1 pb-1 font-semibold">{tr('ui.PrescriptionForm.addition')}</th>
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
        <Field label={tr('ui.PrescriptionForm.ecartPupillaireMm')}><input className="input" placeholder="62" {...register('pupillaryDistance')} /></Field>
        <Field label={tr('ui.PrescriptionForm.typeDeVerres')}>
          {lensOther ? (
            <input className="input" placeholder={tr('ui.PrescriptionForm.preciserLeType')} autoFocus {...register('lensType')} />
          ) : (
            <select
              className="input"
              defaultValue={prescription?.lensType ?? ''}
              onChange={(e) => {
                if (e.target.value === '__other__') {
                  setLensOther(true);
                  setValue('lensType', '');
                } else setValue('lensType', e.target.value);
              }}
            >
              <option value="">{tr('ui.PrescriptionForm.choisir')}</option>
              {lensBaseOptions(pricing).map((o) => (
                <option key={o.key} value={o.label}>{o.label}</option>
              ))}
              <option value="__other__">{tr('ui.PrescriptionForm.autre')}</option>
            </select>
          )}
        </Field>
        <Field label={tr('ui.PrescriptionForm.prescripteur')}><input className="input" {...register('prescriberName')} /></Field>
      </div>

      {/* Mesures avancées de montage */}
      <details className="rounded-xl border border-line bg-surface-2/40 px-3 py-2">
        <summary className="cursor-pointer select-none text-sm font-semibold text-content-muted">
          {tr('ui.PrescriptionForm.mesuresAvanceesDeMontageOptionnel')}
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label={tr('ui.PrescriptionForm.hauteurOdMm')}><input className="input" placeholder="18" {...register('odHeight')} /></Field>
          <Field label={tr('ui.PrescriptionForm.hauteurOgMm')}><input className="input" placeholder="18" {...register('ogHeight')} /></Field>
          <Field label={tr('ui.PrescriptionForm.epPresOdMm')}><input className="input" placeholder="29" {...register('odNearPd')} /></Field>
          <Field label={tr('ui.PrescriptionForm.epPresOgMm')}><input className="input" placeholder="29" {...register('ogNearPd')} /></Field>
          <Field label={tr('ui.PrescriptionForm.vertexMm')}><input className="input" placeholder="12" {...register('vertex')} /></Field>
          <Field label={tr('ui.PrescriptionForm.anglePantoscopique')}><input className="input" placeholder="8" {...register('pantoTilt')} /></Field>
        </div>
      </details>

      <Field label="Notes"><input className="input" {...register('notes')} /></Field>

      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>{tr('ui.PrescriptionForm.annuler')}</Button>
        <Button type="submit" loading={mut.isPending}>
          {isEdit ? tr('ui.PrescriptionForm.enregistrerLesModifications') : tr('ui.PrescriptionForm.enregistrerLOrdonnance')}
        </Button>
      </div>

      {zoomPhoto && photoUrl && (
        <Modal open onClose={() => setZoomPhoto(false)} title={tr('ui.PrescriptionForm.ordonnancePapier')} size="lg">
          <img src={photoUrl} alt={tr('ui.PrescriptionForm.ordonnancePapierAgrandie')} className="max-h-[75vh] w-full object-contain" />
        </Modal>
      )}
    </form>
  );
}

