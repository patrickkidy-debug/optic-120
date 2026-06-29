import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Smartphone, QrCode, CheckCircle2, ImagePlus, Trash2 } from 'lucide-react';
import { getCollectInfo, saveCollectInfo, type CollectInfo } from '../../features/settings/api';
import { usePermission } from '../../store/auth';
import { apiErrorMessage } from '../../lib/api';
import { fileToResizedDataUrl } from '../../lib/image';
import { PageHeader, Button, Field, PageLoader } from '../../components/ui';

const NETWORKS = ['Wave', 'Orange Money', 'MTN MoMo', 'Moov Money', 'Free Money', 'Wizall', 'Autre'];

export function PaymentsPage() {
  const qc = useQueryClient();
  const canUpdate = usePermission('settings.payments.update');
  const { data: collect, isLoading } = useQuery({ queryKey: ['collect-info'], queryFn: getCollectInfo });

  const [form, setForm] = useState<CollectInfo>({ network: '', number: '', name: '', qr: '' });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (collect) setForm(collect);
  }, [collect]);

  const mut = useMutation({
    mutationFn: () => saveCollectInfo(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collect-info'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  async function pickQr(file: File) {
    try {
      const url = await fileToResizedDataUrl(file, 600);
      setForm((f) => ({ ...f, qr: url }));
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Encaissement de vos ventes"
        subtitle="Recevez vos paiements directement sur VOTRE compte Mobile Money — sans intermédiaire"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Formulaire */}
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
              <Smartphone className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display font-bold text-content">Vos coordonnées de paiement</h3>
              <p className="text-xs text-content-muted">
                Affichées au client à la caisse pour qu'il paie directement.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <Field label="Réseau de paiement">
              <select
                className="input"
                value={form.network}
                disabled={!canUpdate}
                onChange={(e) => setForm((f) => ({ ...f, network: e.target.value }))}
              >
                <option value="">— Choisir —</option>
                {NETWORKS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Numéro à créditer">
                <input
                  className="input"
                  placeholder="Ex : +225 01 73 37 46 08"
                  value={form.number}
                  disabled={!canUpdate}
                  onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                />
              </Field>
              <Field label="Nom du bénéficiaire">
                <input
                  className="input"
                  placeholder="Ex : Optique Vision Plus"
                  value={form.name}
                  disabled={!canUpdate}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </Field>
            </div>

            <Field label="QR code marchand (optionnel)">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) pickQr(f);
                  e.target.value = '';
                }}
              />
              <div className="flex items-center gap-4">
                {form.qr ? (
                  <img src={form.qr} alt="QR" className="h-28 w-28 rounded-xl border bg-white object-contain p-1" />
                ) : (
                  <div className="grid h-28 w-28 place-items-center rounded-xl border bg-surface-2 text-content-faint">
                    <QrCode className="h-8 w-8" />
                  </div>
                )}
                {canUpdate && (
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" type="button" onClick={() => fileRef.current?.click()}>
                      <ImagePlus className="h-4 w-4" /> {form.qr ? 'Changer' : 'Importer le QR'}
                    </Button>
                    {form.qr && (
                      <Button variant="ghost" type="button" className="text-danger" onClick={() => setForm((f) => ({ ...f, qr: '' }))}>
                        <Trash2 className="h-4 w-4" /> Retirer
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-content-faint">
                Récupérez votre QR code chez votre opérateur (Wave, Orange Money…) et importez-le ici.
              </p>
            </Field>

            {error && <p className="text-sm text-danger">{error}</p>}
            {canUpdate && (
              <div className="flex items-center gap-3">
                <Button onClick={() => mut.mutate()} loading={mut.isPending}>Enregistrer</Button>
                {saved && (
                  <span className="flex items-center gap-1 text-sm text-success">
                    <CheckCircle2 className="h-4 w-4" /> Enregistré
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Aperçu + info */}
        <div className="card p-5">
          <h3 className="mb-3 font-display font-bold text-content">Comment ça marche</h3>
          <ol className="space-y-2 text-sm text-content-muted">
            <li>1. À la caisse, choisissez « Mobile Money ».</li>
            <li>2. Le client scanne votre <b>QR code</b> ou paie sur votre <b>numéro</b>.</li>
            <li>3. Une fois l'argent reçu, validez « Paiement reçu ».</li>
          </ol>
          <p className="mt-4 rounded-xl bg-surface-2 p-3 text-xs text-content-muted">
            💡 L'argent va <b>directement sur votre compte</b>. OculoSaaS n'intervient jamais dans
            vos encaissements et ne prélève aucune commission.
          </p>
        </div>
      </div>
    </div>
  );
}
