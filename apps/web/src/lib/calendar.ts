/**
 * Aides d'agenda pour les réservations de démonstration : lien « Ajouter à
 * Google Agenda » et export .ics (compatible Google, Apple, Outlook…). Aucune
 * dépendance externe — tout est construit côté client.
 */

export interface CalendarEvent {
  title: string;
  /** Début de l'événement. */
  start: Date;
  /** Fin ; par défaut +45 min. */
  end?: Date;
  details?: string;
  location?: string;
}

/** Formate une date en UTC compact `YYYYMMDDTHHMMSSZ` (format iCal / Google). */
function toUtcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function endOf(ev: CalendarEvent): Date {
  return ev.end ?? new Date(ev.start.getTime() + 45 * 60_000);
}

/** URL « Ajouter à Google Agenda » (pré-remplit un nouvel événement). */
export function googleCalendarUrl(ev: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: `${toUtcStamp(ev.start)}/${toUtcStamp(endOf(ev))}`,
  });
  if (ev.details) params.set('details', ev.details);
  if (ev.location) params.set('location', ev.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Échappe les caractères spéciaux iCal. */
function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** Construit le contenu d'un fichier .ics à partir d'un événement. */
export function buildIcs(ev: CalendarEvent): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OculoSaaS//Demo//FR',
    'BEGIN:VEVENT',
    `UID:${toUtcStamp(ev.start)}-${Math.random().toString(36).slice(2)}@oculosaas`,
    `DTSTAMP:${toUtcStamp(new Date())}`,
    `DTSTART:${toUtcStamp(ev.start)}`,
    `DTEND:${toUtcStamp(endOf(ev))}`,
    `SUMMARY:${icsEscape(ev.title)}`,
  ];
  if (ev.details) lines.push(`DESCRIPTION:${icsEscape(ev.details)}`);
  if (ev.location) lines.push(`LOCATION:${icsEscape(ev.location)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

/** Télécharge l'événement au format .ics. */
export function downloadIcs(filename: string, ev: CalendarEvent): void {
  const blob = new Blob([buildIcs(ev)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
