import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import {
  partnerProfileUpdateSchema,
  partnerChangePasswordSchema,
  type PartnerProfileUpdateInput,
  type PartnerChangePasswordInput,
  type PartnerAuthUser,
} from '@oculo/shared-types';
import { updateProfile, changePassword, logoutPartner } from '../lib/partnerApi';
import { usePartnerAuthStore } from '../store/auth';
import { apiErrorMessage } from '../lib/api';
import { Button, Field, PasswordInput, PageHeader } from '../components/ui';

const TIER_LABEL: Record<string, string> = {
  AMBASSADOR: 'Ambassador',
  PARTNER_PRO: 'Partner Pro',
  PARTNER_EXPERT: 'Partner Expert',
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'En attente de validation',
  ACTIVE: 'Actif',
  SUSPENDED: 'Suspendu',
  REJECTED: 'Refusé',
};

export function ProfilePage() {
  const partner = usePartnerAuthStore((s) => s.partner);
  const setAuth = usePartnerAuthStore((s) => s.setAuth);
  const accessToken = usePartnerAuthStore((s) => s.accessToken);
  if (!partner) return null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Mon profil"
        subtitle={`Niveau ${TIER_LABEL[partner.tier] ?? partner.tier} · ${STATUS_LABEL[partner.status] ?? partner.status}`}
      />
      <ProfileForm
        partner={partner}
        onSaved={(updated) => setAuth(accessToken!, updated)}
      />
      <PasswordForm />
    </div>
  );
}

function ProfileForm({
  partner,
  onSaved,
}: {
  partner: PartnerAuthUser;
  onSaved: (updated: PartnerAuthUser) => void;
}) {
  const [serverError, setServerError] = useState('');
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PartnerProfileUpdateInput>({
    resolver: zodResolver(partnerProfileUpdateSchema),
    defaultValues: {
      firstName: partner.firstName,
      lastName: partner.lastName,
      email: partner.email,
      whatsapp: partner.whatsapp,
      countryCode: partner.countryCode ?? '',
      city: partner.city ?? '',
      payoutMethod: partner.payoutMethod ?? '',
    },
  });

  async function onSubmit(values: PartnerProfileUpdateInput) {
    setServerError('');
    setSaved(false);
    try {
      const updated = await updateProfile(values);
      onSaved(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setServerError(apiErrorMessage(e, 'Mise à jour impossible'));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4 p-6">
      <h3 className="font-display font-bold text-content-heading">Informations personnelles</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Prénom">
          <input className="input" {...register('firstName')} />
          {errors.firstName && <p className="mt-1 text-xs text-danger">{errors.firstName.message}</p>}
        </Field>
        <Field label="Nom">
          <input className="input" {...register('lastName')} />
          {errors.lastName && <p className="mt-1 text-xs text-danger">{errors.lastName.message}</p>}
        </Field>
      </div>
      <Field label="Email">
        <input className="input" type="email" {...register('email')} />
        {errors.email && <p className="mt-1 text-xs text-danger">{errors.email.message}</p>}
      </Field>
      <Field label="Numéro WhatsApp">
        <input className="input" {...register('whatsapp')} />
        {errors.whatsapp && <p className="mt-1 text-xs text-danger">{errors.whatsapp.message}</p>}
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Pays (code)">
          <input className="input" placeholder="CI" maxLength={2} {...register('countryCode')} />
        </Field>
        <Field label="Ville">
          <input className="input" {...register('city')} />
        </Field>
      </div>
      <Field label="Moyen de paiement préféré (Mobile Money, virement…)">
        <input className="input" {...register('payoutMethod')} />
      </Field>
      {serverError && <p className="text-sm text-danger">{serverError}</p>}
      {saved && <p className="text-sm text-success">Profil mis à jour.</p>}
      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const clear = usePartnerAuthStore((s) => s.clear);
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PartnerChangePasswordInput & { confirmPassword: string }>({
    resolver: zodResolver(
      partnerChangePasswordSchema.extend({
        confirmPassword: partnerChangePasswordSchema.shape.newPassword,
      }),
    ),
  });

  async function onSubmit(values: PartnerChangePasswordInput & { confirmPassword: string }) {
    setServerError('');
    if (values.newPassword !== values.confirmPassword) {
      setServerError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    try {
      await changePassword(values);
      // Par sécurité, le changement de mot de passe révoque toutes les
      // sessions : on renvoie immédiatement vers la connexion.
      await logoutPartner().catch(() => {});
      clear();
      navigate('/login');
    } catch (e) {
      setServerError(apiErrorMessage(e, 'Changement de mot de passe impossible'));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4 p-6">
      <h3 className="font-display font-bold text-content-heading">Changer de mot de passe</h3>
      <Field label="Mot de passe actuel">
        <PasswordInput {...register('currentPassword')} />
        {errors.currentPassword && <p className="mt-1 text-xs text-danger">{errors.currentPassword.message}</p>}
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nouveau mot de passe">
          <PasswordInput {...register('newPassword')} />
          {errors.newPassword && <p className="mt-1 text-xs text-danger">{errors.newPassword.message}</p>}
        </Field>
        <Field label="Confirmer le nouveau mot de passe">
          <PasswordInput {...register('confirmPassword')} />
          {errors.confirmPassword && <p className="mt-1 text-xs text-danger">{errors.confirmPassword.message}</p>}
        </Field>
      </div>
      {watch('newPassword') && watch('confirmPassword') && watch('newPassword') !== watch('confirmPassword') && (
        <p className="text-xs text-danger">Les mots de passe ne correspondent pas.</p>
      )}
      {serverError && <p className="text-sm text-danger">{serverError}</p>}
      <div className="flex justify-end">
        <Button type="submit" variant="outline" loading={isSubmitting}>
          Changer le mot de passe
        </Button>
      </div>
    </form>
  );
}
