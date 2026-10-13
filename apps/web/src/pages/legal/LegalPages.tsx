import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { API_URL } from '../../lib/api';

/* ============================================================
 * Pages légales publiques (exigées par Google Play) :
 *  - /confidentialite : politique de confidentialité
 *  - /suppression-compte : demande de suppression du compte et des données
 * Accessibles sans compte, depuis le site comme depuis l'application.
 * ============================================================ */

const UPDATED = '11 octobre 2026';

function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="light min-h-screen bg-white text-content">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-extrabold">
            <img src="/icon-192.png" alt="" className="h-8 w-8 rounded-lg" /> Oculo<span className="text-gradient">SaaS</span>
          </Link>
          <nav className="flex gap-4 text-sm text-content-muted">
            <Link to="/confidentialite" className="hover:text-primary">Confidentialité</Link>
            <Link to="/suppression-compte" className="hover:text-primary">Suppression du compte</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="font-display text-3xl font-extrabold">{title}</h1>
        <p className="mt-2 text-sm text-content-muted">Dernière mise à jour : {UPDATED}</p>
        <div className="legal mt-8 space-y-6 leading-relaxed text-content-muted [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-content [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-content">
          {children}
        </div>
      </main>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell title="Politique de confidentialité">
      <p>
        Cette politique explique quelles données OculoSaaS (logiciel de gestion pour magasins d’optique et cliniques ophtalmologiques,
        site oculosaas.com et application Android) collecte, pourquoi, et comment vous pouvez exercer vos droits.
      </p>

      <h2>1. Qui sommes-nous</h2>
      <p>
        OculoSaaS est édité par Eloge KONAN. Contact : <strong>support@oculosaas.com</strong> ou WhatsApp <strong>+221 76 888 17 39</strong>.
      </p>

      <h2>2. Rôles</h2>
      <p>
        Pour les données de votre compte et de votre abonnement, OculoSaaS est responsable du traitement. Pour les données que votre établissement
        enregistre sur ses propres clients et patients (fiches, ordonnances, mesures, ventes), votre établissement est responsable du traitement
        et OculoSaaS agit en tant que sous-traitant : nous les traitons uniquement pour fournir le service.
      </p>

      <h2>3. Données collectées</h2>
      <ul>
        <li><strong>Compte</strong> : nom, adresse e-mail, téléphone, rôle, mot de passe (stocké uniquement sous forme hachée).</li>
        <li><strong>Établissement et abonnement</strong> : nom de l’établissement, pays, ville, forfait, factures d’abonnement, historique des paiements.</li>
        <li><strong>Données de gestion saisies par l’établissement</strong> : produits et stock, ventes et encaissements, clients et leurs ordonnances optiques, mesures, commandes de verres, patients et consultations (module clinique), fournisseurs, employés, dépenses.</li>
        <li><strong>Photos</strong> : photos de produits, logo, photos d’ordonnance ou de mesure, uniquement lorsque vous les ajoutez.</li>
        <li><strong>Données techniques</strong> : journal d’activité (qui a fait quoi et quand), adresse IP et type d’appareil pour la sécurité des connexions.</li>
      </ul>

      <h2>4. Caméra et microphone</h2>
      <p>
        L’application demande la caméra seulement quand vous l’utilisez : scanner un QR code ou un code-barres, prendre une photo, ou mesurer
        les écarts pupillaires avec l’assistant de centrage. L’analyse du visage pour les mesures est faite sur l’appareil ; une image n’est
        envoyée à nos serveurs que si vous enregistrez une mesure avec photo. Le microphone n’est utilisé que si vous démarrez une conversation
        vocale avec le conseiller IA : votre voix est alors transcrite par le service de reconnaissance vocale de votre navigateur.
      </p>

      <h2>5. Pourquoi nous utilisons ces données</h2>
      <ul>
        <li>Fournir le logiciel et ses fonctionnalités (exécution du contrat).</li>
        <li>Gérer votre abonnement et la facturation.</li>
        <li>Assurer la sécurité : authentification, prévention des abus, journal d’activité.</li>
        <li>Vous assister lorsque vous contactez le support.</li>
        <li>Mesurer l’audience du site et de nos campagnes publicitaires (site web uniquement, voir section 7).</li>
      </ul>
      <p>Nous ne vendons pas vos données et ne les utilisons pas pour de la publicité ciblée dans l’application.</p>

      <h2>6. Prestataires</h2>
      <p>Nous faisons appel à des prestataires qui traitent des données pour notre compte, uniquement pour les besoins du service :</p>
      <ul>
        <li>Hébergement des serveurs, de la base de données et des fichiers.</li>
        <li>Paiement de l’abonnement (prestataires de mobile money et de paiement en ligne) : nous ne conservons aucune donnée de carte bancaire.</li>
        <li>Envoi des e-mails transactionnels.</li>
        <li>Connexion avec Google, si vous choisissez cette option.</li>
        <li>Conseiller commercial IA et assistant WhatsApp : le texte des échanges est transmis au fournisseur du modèle d’IA (Anthropic) pour générer la réponse. Le texte des conversations du conseiller n’est pas conservé par OculoSaaS ; seul un résumé anonyme du besoin est gardé pour nos statistiques.</li>
      </ul>

      <h2>7. Site web : mesure d’audience</h2>
      <p>
        Le site oculosaas.com utilise le pixel Meta (Facebook) pour mesurer l’efficacité de nos publicités. L’application Android ne contient pas
        de traceur publicitaire.
      </p>

      <h2>8. Sécurité</h2>
      <ul>
        <li>Les données de chaque établissement sont cloisonnées de celles des autres.</li>
        <li>Les échanges entre l’application et nos serveurs sont protégés par HTTPS.</li>
        <li>Les mots de passe sont hachés (Argon2id) ; l’authentification à deux facteurs est disponible.</li>
        <li>Les accès sont limités par rôles et permissions, et les actions sont journalisées.</li>
      </ul>

      <h2>9. Durée de conservation</h2>
      <p>
        Les données sont conservées tant que le compte de l’établissement existe. Après une demande de suppression, le compte et les données de
        gestion sont supprimés dans un délai de 30 jours. Les factures d’abonnement peuvent être conservées plus longtemps lorsque la loi
        l’impose (obligations comptables).
      </p>

      <h2>10. Vos droits</h2>
      <p>
        Vous pouvez demander l’accès, la rectification, l’export ou la suppression de vos données. Une grande partie des données peut être
        exportée directement depuis le logiciel. Pour supprimer votre compte, utilisez la page{' '}
        <Link to="/suppression-compte" className="font-semibold text-primary underline">suppression du compte</Link>. Pour toute autre demande,
        écrivez à support@oculosaas.com.
      </p>

      <h2>11. Mineurs</h2>
      <p>OculoSaaS est un logiciel professionnel destiné aux établissements d’optique ; il ne s’adresse pas aux mineurs.</p>

      <h2>12. Modifications</h2>
      <p>Nous pouvons mettre à jour cette politique ; la date de dernière mise à jour figure en haut de la page.</p>
    </LegalShell>
  );
}

export function AccountDeletionPage() {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState('sending');
    try {
      const r = await fetch(`${API_URL}/public/account-deletion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(f.entries())),
      });
      setState(r.ok ? 'sent' : 'error');
    } catch {
      setState('error');
    }
  }

  return (
    <LegalShell title="Supprimer votre compte OculoSaaS">
      <p>
        Vous pouvez demander la suppression de votre compte et des données de votre établissement, depuis l’application ou depuis cette page,
        sans avoir besoin de l’application installée.
      </p>

      <h2>Ce qui est supprimé</h2>
      <ul>
        <li>Les comptes utilisateurs de l’établissement (noms, e-mails, téléphones, mots de passe).</li>
        <li>Les données de gestion : produits, stock, ventes, clients, ordonnances, mesures, commandes, patients, fournisseurs, employés, photos.</li>
      </ul>
      <h2>Ce qui peut être conservé</h2>
      <ul>
        <li>Les factures d’abonnement, lorsque la loi impose de les garder (obligations comptables).</li>
      </ul>
      <h2>Délai</h2>
      <p>
        Nous vérifions que la demande vient bien du titulaire du compte (par e-mail ou téléphone), puis la suppression est effectuée dans un délai
        de 30 jours. Si seul un utilisateur (et non tout l’établissement) doit être supprimé, l’administrateur de l’établissement peut aussi le
        désactiver depuis Paramètres → Utilisateurs.
      </p>

      <h2>Faire la demande</h2>
      {state === 'sent' ? (
        <div className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success/10 p-5 text-content">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          <p>Demande reçue. Nous allons vous contacter pour confirmer votre identité, puis supprimer vos données dans un délai de 30 jours.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-line p-5">
          <label className="block text-sm font-semibold text-content">
            Nom complet
            <input name="name" required minLength={2} maxLength={120} autoComplete="name" className="input mt-1" />
          </label>
          <label className="block text-sm font-semibold text-content">
            E-mail du compte
            <input name="email" type="email" required maxLength={160} autoComplete="email" className="input mt-1" />
          </label>
          <label className="block text-sm font-semibold text-content">
            Téléphone (facultatif)
            <input name="phone" type="tel" maxLength={30} autoComplete="tel" className="input mt-1" />
          </label>
          <label className="block text-sm font-semibold text-content">
            Nom de l’établissement
            <input name="establishment" required minLength={2} maxLength={160} className="input mt-1" />
          </label>
          <label className="block text-sm font-semibold text-content">
            Que faut-il supprimer ?
            <select name="scope" className="input mt-1" defaultValue="ALL">
              <option value="ALL">Tout le compte de l’établissement et ses données</option>
              <option value="USER">Seulement mon compte utilisateur</option>
            </select>
          </label>
          <label className="block text-sm font-semibold text-content">
            Message (facultatif)
            <textarea name="message" maxLength={2000} rows={3} className="input mt-1" />
          </label>
          {state === 'error' && <p className="text-sm text-danger">La demande n’a pas pu être envoyée. Réessayez ou écrivez à support@oculosaas.com.</p>}
          <button type="submit" disabled={state === 'sending'} className="btn-primary w-full">
            {state === 'sending' ? 'Envoi…' : 'Demander la suppression'}
          </button>
        </form>
      )}
      <p className="text-sm">
        Vous pouvez aussi écrire à <strong>support@oculosaas.com</strong> en indiquant l’e-mail du compte et le nom de l’établissement.
      </p>
    </LegalShell>
  );
}
