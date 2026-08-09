import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { LENS_ORDER_STATUS_LABELS, type LensOrderStatus } from '@oculo/shared-types';
import type { LensOrder } from '../../features/optique/api';

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Grille du mois (semaines commençant le lundi), y compris les jours hors mois pour compléter les rangées. */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // lundi = 0
  const start = new Date(year, month, 1 - startOffset);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

/**
 * Vue calendrier des commandes de verres, groupées par date prévue de
 * livraison. Les commandes déjà livrées ou annulées n'y figurent pas — c'est
 * un outil de planification, pas un historique.
 */
export function LensOrderCalendar({
  orders,
  onOpen,
}: {
  orders: LensOrder[];
  onOpen: (order: LensOrder) => void;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const pending = useMemo(
    () => orders.filter((o) => o.expectedAt && o.status !== 'DELIVERED' && o.status !== 'CANCELLED'),
    [orders],
  );
  const byDay = useMemo(() => {
    const map = new Map<string, LensOrder[]>();
    pending.forEach((o) => {
      const key = ymd(new Date(o.expectedAt!));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    });
    return map;
  }, [pending]);

  const days = monthGrid(cursor.getFullYear(), cursor.getMonth());
  const todayKey = ymd(today);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-content">
          {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
            className="btn-ghost h-8 w-8 rounded-lg p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="btn-outline h-8 rounded-lg px-2.5 text-xs"
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
            className="btn-ghost h-8 w-8 rounded-lg p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border bg-line">
        {WEEKDAYS.map((w) => (
          <div key={w} className="bg-surface-2 px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-content-faint">
            {w}
          </div>
        ))}
        {days.map((d) => {
          const key = ymd(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const items = byDay.get(key) ?? [];
          const late = items.some((o) => new Date(o.expectedAt!).getTime() < Date.now());
          return (
            <div
              key={key}
              className={`min-h-[6.5rem] bg-surface p-1.5 ${inMonth ? '' : 'opacity-40'}`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-medium ${
                    key === todayKey ? 'rounded-full bg-primary px-1.5 py-0.5 text-white' : 'text-content-muted'
                  }`}
                >
                  {d.getDate()}
                </span>
                {late && <AlertTriangle className="h-3 w-3 text-danger" />}
              </div>
              <div className="mt-1 space-y-1">
                {items.slice(0, 3).map((o) => (
                  <button
                    key={o.id}
                    onClick={() => onOpen(o)}
                    title={`${o.number} — ${LENS_ORDER_STATUS_LABELS[o.status as LensOrderStatus]}`}
                    className="block w-full truncate rounded-md bg-primary-soft px-1.5 py-0.5 text-left text-[11px] font-medium text-primary hover:bg-primary/20"
                  >
                    {o.customer ? o.customer.firstName : o.number}
                  </button>
                ))}
                {items.length > 3 && (
                  <p className="px-1 text-[10px] text-content-faint">+{items.length - 3} autre(s)</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
