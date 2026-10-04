import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BellRing, MessageCircle } from 'lucide-react';
import { listRenewals } from '../../features/optique/api';
import { Avatar } from '../Avatar';
import { formatDate } from '../../lib/format';
import { WhatsappSendButton } from '../WhatsappSendButton';
import { sendWhatsappForStage } from '../../lib/whatsapp';
import { useAuthStore } from '../../store/auth';
import { tr } from '../../lib/tr';

function waLink(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, '');
  return digits ? `https://wa.me/${digits}` : null;
}

/** Clients à recontacter (ordonnance/achat à renouveler), même cache que la page Renouvellements. */
export function RenewalsWidget({ enabled }: { enabled: boolean }) {
  const { data, isLoading } = useQuery({ queryKey: ['renewals'], queryFn: listRenewals, enabled });
  const renewals = data ?? [];
  const tenantName = useAuthStore((s) => s.user?.tenantName) ?? 'OculoSaaS';

  if (!enabled) return null;

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="font-display font-bold text-content">{tr('ui.RenewalsWidget.renouvellements')}</h3>
        <Link to="/optique/renouvellements" className="shrink-0 text-xs font-semibold text-primary hover:underline">
          {tr('ui.RenewalsWidget.voirTout')}
        </Link>
      </div>
      {isLoading ? (
        <p className="text-sm text-content-muted">{tr('ui.RenewalsWidget.chargement')}</p>
      ) : renewals.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-content-muted">
          <BellRing className="h-6 w-6 text-content-faint" />
          {tr('ui.RenewalsWidget.aucunRappelPourLeMoment')}
        </div>
      ) : (
        <div className="space-y-3">
          {renewals.slice(0, 5).map((c) => {
            const wa = waLink(c.phone);
            return (
              <div key={c.id} className="flex items-center gap-3">
                <Avatar
                  firstName={c.firstName}
                  lastName={c.lastName}
                  className="h-9 w-9 shrink-0 rounded-full text-xs"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-content">
                    {c.firstName} {c.lastName}
                  </p>
                  <p className="truncate text-xs text-content-faint">
                    {c.lastLensType ? `${c.lastLensType} · ` : ''}
                    {c.recommendedAt
                      ? tr('ui.RenewalsWidget.recommandeDepuisLeRecommendedat', { recommendedAt: formatDate(c.recommendedAt) })
                      : c.renewPrescription
                        ? tr('ui.RenewalsWidget.ordonnanceARenouveler')
                        : tr('ui.RenewalsWidget.nouvelAchatAProposer')}
                  </p>
                </div>
                {wa && (
                  <WhatsappSendButton
                    onSend={(lang) =>
                      sendWhatsappForStage('renewal', c.phone, { client: c.firstName ?? '', etablissement: tenantName }, lang)
                    }
                    className="btn-outline h-8 shrink-0 rounded-lg px-2.5 text-xs text-success"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> {tr('ui.RenewalsWidget.contacter')}
                  </WhatsappSendButton>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
