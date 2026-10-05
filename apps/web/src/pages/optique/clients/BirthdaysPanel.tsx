import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Cake, ChevronDown, ChevronUp, MessageCircle, PartyPopper } from 'lucide-react';
import { getBirthdays, type CustomerBirthday } from '../../../features/optique/api';
import { useAuthStore } from '../../../store/auth';
import { displayLocale } from '../../../lib/format';
import { sendWhatsappForStage } from '../../../lib/whatsapp';
import { Avatar } from '../../../components/Avatar';
import { WhatsappSendButton } from '../../../components/WhatsappSendButton';
import { tr } from '../../../lib/tr';

type Range = 'today' | 'week' | 'month';

/**
 * Anniversaires des clients (date de naissance de la fiche) : aujourd'hui,
 * 7 et 30 prochains jours, avec un message de vœux WhatsApp pré-rempli.
 */
export function BirthdaysPanel({ branchId, onOpen }: { branchId?: string; onOpen: (id: string) => void }) {
  const user = useAuthStore((s) => s.user);
  const [range, setRange] = useState<Range>('today');
  const [collapsed, setCollapsed] = useState(false);
  const { data } = useQuery({ queryKey: ['customer-birthdays', branchId], queryFn: () => getBirthdays(branchId, 30) });

  const all = data?.birthdays ?? [];
  const today = all.filter((b) => b.daysUntil === 0);
  const week = all.filter((b) => b.daysUntil <= 7);
  const list = range === 'today' ? today : range === 'week' ? week : all;
  // Par défaut on montre aujourd'hui s'il y en a, sinon la semaine.
  const effective: Range = range === 'today' && today.length === 0 && week.length > 0 ? 'week' : range;
  const shown = effective === range ? list : week;

  const fmt = (iso: string) => new Intl.DateTimeFormat(displayLocale(), { day: 'numeric', month: 'long' }).format(new Date(iso));
  const when = (b: CustomerBirthday) =>
    b.daysUntil === 0 ? tr('bday.today') : b.daysUntil === 1 ? tr('bday.tomorrow') : tr('bday.inDays', { n: b.daysUntil });

  const tabs: { id: Range; label: string; n: number }[] = [
    { id: 'today', label: tr('bday.tabToday'), n: today.length },
    { id: 'week', label: tr('bday.tabWeek'), n: week.length },
    { id: 'month', label: tr('bday.tabMonth'), n: all.length },
  ];

  return (
    <section className="card mb-5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <button type="button" className="flex items-center gap-2 text-left" onClick={() => setCollapsed((v) => !v)} aria-expanded={!collapsed}>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[color:var(--accent)]/12 text-accent">
            <Cake className="h-4 w-4" />
          </span>
          <span>
            <span className="block font-semibold text-content">{tr('bday.title')}</span>
            <span className="block text-xs text-content-faint">
              {today.length > 0 ? tr('bday.todayCount', { n: today.length }) : tr('bday.upcomingCount', { n: all.length })}
            </span>
          </span>
          {collapsed ? <ChevronDown className="h-4 w-4 text-content-faint" /> : <ChevronUp className="h-4 w-4 text-content-faint" />}
        </button>
        {!collapsed && (
          <div className="flex gap-1" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={effective === t.id}
                onClick={() => setRange(t.id)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  effective === t.id ? 'bg-primary text-white' : 'bg-surface-2 text-content-muted hover:text-content'
                }`}
              >
                {t.label} <span className="opacity-70">{t.n}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="border-t px-4 py-3">
          {!data ? (
            <div className="h-16 animate-pulse rounded-xl bg-surface-2" />
          ) : shown.length === 0 ? (
            <p className="text-sm text-content-muted">
              {all.length === 0 ? tr('bday.none30') : tr('bday.noneRange')}
              {data.withBirthDate === 0 && <span className="block text-xs text-content-faint">{tr('bday.hintDob')}</span>}
            </p>
          ) : (
            <ul className="flex snap-x gap-3 overflow-x-auto pb-1">
              {shown.map((b) => (
                <li
                  key={b.id}
                  className={`flex w-60 shrink-0 snap-start flex-col rounded-xl border p-3 ${b.daysUntil === 0 ? 'border-[color:var(--accent)]/40 bg-[color:var(--accent)]/5' : 'bg-surface'}`}
                >
                  <button type="button" className="flex items-center gap-2.5 text-left" onClick={() => onOpen(b.id)}>
                    <Avatar firstName={b.firstName} lastName={b.lastName} className="h-9 w-9 shrink-0 rounded-full text-xs" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-content hover:text-primary">
                        {b.firstName} {b.lastName}
                      </span>
                      <span className="block text-xs text-content-faint">
                        {fmt(b.nextBirthday)} · {tr('bday.turning', { n: b.turning })}
                      </span>
                    </span>
                  </button>
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${b.daysUntil === 0 ? 'text-accent' : 'text-content-muted'}`}>
                      {b.daysUntil === 0 && <PartyPopper className="h-3.5 w-3.5" />}
                      {when(b)}
                    </span>
                    {b.phone && b.phone.replace(/\D/g, '').length >= 6 && (
                      <WhatsappSendButton
                        onSend={(lang) =>
                          sendWhatsappForStage('birthday', b.phone, { client: b.firstName, etablissement: user?.tenantName ?? 'OculoSaaS' }, lang)
                        }
                        className="btn-outline h-7 rounded-lg px-2 text-xs text-success"
                        title={tr('bday.wish')}
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> {tr('bday.wishShort')}
                      </WhatsappSendButton>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
