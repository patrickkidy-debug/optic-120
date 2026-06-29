import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LifeBuoy, Mail, MessageCircle, Send, CheckCircle2 } from 'lucide-react';
import { supportTicketSchema, type SupportTicketInput } from '@oculo/shared-types';
import { createSupportTicket } from '../features/support/api';
import { apiErrorMessage } from '../lib/api';
import { PageHeader, Button, Field } from '../components/ui';

const SUPPORT_EMAIL = 'oculossaas@gmail.com';
const WHATSAPP = '221768881739'; // numéro de support (format international, sans +)

const FAQ = [
  { q: 'Comment encaisser par Mobile Money ?', a: 'À la caisse, choisissez le moyen Mobile Money ; le client est redirigé vers PayTech pour valider le paiement.' },
  { q: 'Comment ajouter un employé ?', a: 'Paramètres → Utilisateurs → Nouvel utilisateur, puis choisissez son rôle (caissier, opticien…).' },
  { q: 'Comment activer la double authentification ?', a: 'Paramètres → Profil → section Sécurité → Activer la 2FA, puis scannez le QR code.' },
  { q: 'Comment gérer plusieurs magasins ?', a: 'L’offre Standard et Premium permettent de gérer plusieurs magasins depuis un seul compte.' },
];

export function SupportPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupportTicketInput>({ resolver: zodResolver(supportTicketSchema) });

  async function onSubmit(values: SupportTicketInput) {
    setError('');
    try {
      await createSupportTicket(values);
      setSent(true);
      reset();
    } catch (e) {
      setError(apiErrorMessage(e, 'Envoi impossible'));
    }
  }

  return (
    <div>
      <PageHeader title="Aide & support" subtitle="Une question ? Un problème ? Nous sommes là." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Contacts rapides */}
        <div className="space-y-4">
          <a
            href={`https://wa.me/${WHATSAPP}`}
            target="_blank"
            rel="noopener noreferrer"
            className="card flex items-center gap-3 p-4 transition hover:border-primary"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#25D366]/15 text-[#25D366]">
              <MessageCircle className="h-5 w-5" />
            </span>
            <div>
              <div className="font-semibold text-content">WhatsApp</div>
              <div className="text-xs text-content-muted">Réponse rapide</div>
            </div>
          </a>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="card flex items-center gap-3 p-4 transition hover:border-primary"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
              <Mail className="h-5 w-5" />
            </span>
            <div>
              <div className="font-semibold text-content">Email</div>
              <div className="text-xs text-content-muted">{SUPPORT_EMAIL}</div>
            </div>
          </a>
        </div>

        {/* Formulaire */}
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-primary" />
            <h3 className="font-display font-bold text-content">Envoyer une demande</h3>
          </div>

          {sent ? (
            <div className="grid place-items-center py-10 text-center">
              <CheckCircle2 className="h-12 w-12 text-success" />
              <p className="mt-3 font-display text-lg font-bold text-content">Demande envoyée !</p>
              <p className="mt-1 text-sm text-content-muted">Notre équipe vous répondra dans les meilleurs délais.</p>
              <Button variant="outline" className="mt-5" onClick={() => setSent(false)}>Nouvelle demande</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Field label="Sujet">
                <input className="input" placeholder="Ex : Problème d'encaissement" {...register('subject')} />
                {errors.subject && <p className="mt-1 text-xs text-danger">{errors.subject.message}</p>}
              </Field>
              <Field label="Message">
                <textarea className="input min-h-[140px]" placeholder="Décrivez votre demande…" {...register('message')} />
                {errors.message && <p className="mt-1 text-xs text-danger">{errors.message.message}</p>}
              </Field>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" loading={isSubmitting}>
                <Send className="h-4 w-4" /> Envoyer
              </Button>
            </form>
          )}
        </div>
      </div>

      {/* FAQ */}
      <div className="card mt-4 p-5">
        <h3 className="mb-3 font-display font-bold text-content">Questions fréquentes</h3>
        <div className="space-y-2">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-xl bg-surface-2 p-4">
              <summary className="cursor-pointer font-medium text-content marker:content-none">{f.q}</summary>
              <p className="mt-2 text-sm text-content-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
