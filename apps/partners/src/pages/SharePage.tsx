import { useState } from 'react';
import { Copy, Check, MessageCircle, Share2 } from 'lucide-react';
import { usePartnerAuthStore } from '../store/auth';
import { PageHeader, Button } from '../components/ui';

function shareMessage(link: string): string {
  return (
    `OculoSaaS : le logiciel tout-en-un pour gérer votre optique — caisse, stocks, ` +
    `patients, paiements Mobile Money et rapports. À partir de 7 500 FCFA/mois.\n\n${link}`
  );
}

export function SharePage() {
  const partner = usePartnerAuthStore((s) => s.partner);
  const [copied, setCopied] = useState(false);
  if (!partner) return null;

  const message = shareMessage(partner.referralLink);

  function copyLink() {
    navigator.clipboard.writeText(partner!.referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function nativeShare() {
    if (navigator.share) {
      navigator.share({ text: message, url: partner!.referralLink }).catch(() => {});
    } else {
      copyLink();
    }
  }

  return (
    <div>
      <PageHeader title="Partager mon lien" subtitle="Chaque inscription via ce lien vous est attribuée pendant 90 jours" />

      <div className="card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-content-faint">Votre code</p>
        <p className="mt-1 font-display text-2xl font-bold text-primary">{partner.referralCode}</p>
        <p className="mt-3 break-all rounded-lg bg-surface-2 px-3 py-2 text-sm text-content">
          {partner.referralLink}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary col-span-2 justify-center bg-[#25D366] hover:bg-[#1ebe57]"
        >
          <MessageCircle className="h-4 w-4" /> Partager sur WhatsApp
        </a>
        <Button variant="outline" onClick={copyLink}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copié' : 'Copier le lien'}
        </Button>
        <Button variant="outline" onClick={nativeShare}>
          <Share2 className="h-4 w-4" /> Autre app
        </Button>
      </div>

      <div className="mt-6 rounded-xl border border-dashed p-4 text-sm text-content-muted">
        Recommandez OculoSaaS aux opticiens que vous connaissez : dès qu'un magasin s'inscrit via
        votre lien et paie son premier abonnement, une commission vous est automatiquement créditée.
      </div>
    </div>
  );
}
