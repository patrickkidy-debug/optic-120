import { api } from '../../lib/api';

export type ProspectStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'REPLIED'
  | 'DEMO_SCHEDULED'
  | 'DEMO_COMPLETED'
  | 'TRIAL'
  | 'CUSTOMER'
  | 'LOST';
export type ProspectSegment = 'DISCOVERY' | 'STANDARD' | 'PREMIUM';
export type ProspectPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'HOT';
export type ProspectSource =
  | 'IMPORT_EXCEL'
  | 'FACEBOOK_ADS'
  | 'WHATSAPP'
  | 'LANDING_PAGE'
  | 'DEMO'
  | 'REFERRAL'
  | 'MANUAL';
export type WhatsappStatus =
  | 'WHATSAPP_VERIFIED'
  | 'PHONE_VALID_WHATSAPP_UNCONFIRMED'
  | 'PHONE_INVALID'
  | 'VERIFICATION_FAILED';

export interface Prospect {
  id: string;
  firstName: string | null;
  lastName: string | null;
  establishmentName: string;
  phone: string | null;
  phoneNormalized: string | null;
  phoneCountry: string | null;
  email: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  website: string | null;
  segment: ProspectSegment;
  leadScore: number;
  scoreOverride: number | null;
  priority: ProspectPriority;
  status: ProspectStatus;
  source: ProspectSource;
  lastContactAt: string | null;
  nextFollowUpAt: string | null;
  demoDate: string | null;
  notes: string | null;
  whatsappStatus: WhatsappStatus;
  createdAt: string;
}

export interface ProspectEvent {
  id: string;
  type: string;
  label: string;
  createdAt: string;
}

export interface ProspectFilters {
  search?: string;
  status?: string;
  segment?: string;
  priority?: string;
  source?: string;
  whatsappStatus?: string;
  country?: string;
  city?: string;
  minScore?: number;
  dueOnly?: boolean;
  hasEmail?: boolean;
  page?: number;
  pageSize?: number;
}

export async function listProspects(f: ProspectFilters) {
  const { data } = await api.get<{ items: Prospect[]; total: number; page: number; pageSize: number }>(
    '/crm/prospects',
    { params: f },
  );
  return data;
}

export async function getProspect(id: string) {
  const { data } = await api.get<{ prospect: Prospect & { events: ProspectEvent[] } }>(`/crm/prospects/${id}`);
  return data.prospect;
}

export async function createProspect(body: Record<string, unknown>) {
  await api.post('/crm/prospects', body);
}

export async function updateProspect(id: string, body: Record<string, unknown>) {
  const { data } = await api.patch<{ prospect: Prospect }>(`/crm/prospects/${id}`, body);
  return data.prospect;
}

export async function deleteProspect(id: string) {
  await api.delete(`/crm/prospects/${id}`);
}

export async function addProspectNote(id: string, text: string) {
  await api.post(`/crm/prospects/${id}/notes`, { text });
}

export async function markContacted(id: string, templateName: string) {
  await api.post(`/crm/prospects/${id}/contacted`, { templateName });
}

export async function setWhatsappStatus(id: string, status: WhatsappStatus) {
  await api.post(`/crm/prospects/${id}/whatsapp-status`, { status });
}

export interface ImportRow {
  firstName: string;
  lastName: string;
  establishmentName: string;
  phone: string;
  phoneNormalized: string | null;
  phoneCountry: string | null;
  email: string;
  country: string;
  city: string;
  address: string;
  segment: ProspectSegment;
  whatsappStatus: WhatsappStatus;
  leadScore: number;
  outcome: 'new' | 'duplicate' | 'invalid';
  reason?: string;
}

export async function previewProspectImport(file: File): Promise<ImportRow[]> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<{ rows: ImportRow[] }>('/crm/import/preview', form);
  return data.rows;
}

export async function commitProspectImport(rows: ImportRow[], source: ProspectSource) {
  const { data } = await api.post<{ created: number; skipped: number }>('/crm/import/commit', { rows, source });
  return data;
}

export interface CrmStats {
  total: number;
  newThisMonth: number;
  dueToday: number;
  contacted: number;
  replied: number;
  demosScheduled: number;
  demos: number;
  trials: number;
  customers: number;
  lost: number;
  replyRate: number;
  conversionRate: number;
  funnel: { key: string; value: number }[];
  sources: { source: ProspectSource; total: number; trials: number; customers: number }[];
}

export async function getCrmStats() {
  const { data } = await api.get<{ stats: CrmStats }>('/crm/stats');
  return data.stats;
}

export interface MessageTemplate {
  id: string;
  key: string;
  name: string;
  body: string;
  isDefault: boolean;
  sortOrder: number;
}

export async function listTemplates() {
  const { data } = await api.get<{ templates: MessageTemplate[] }>('/crm/templates');
  return data.templates;
}

export async function saveTemplate(body: { id?: string; name: string; body: string }) {
  await api.post('/crm/templates', body);
}

export async function deleteTemplate(id: string) {
  await api.delete(`/crm/templates/${id}`);
}

export interface CrmSettings {
  demoVideosUrl: string | null;
  signupUrl: string | null;
  demoBookingUrl: string | null;
}

export async function getCrmSettings() {
  const { data } = await api.get<{ settings: CrmSettings }>('/crm/settings');
  return data.settings;
}

export async function updateCrmSettings(body: CrmSettings) {
  await api.put('/crm/settings', body);
}

/** Message avec variables déjà remplacées, prêt à ouvrir dans WhatsApp. */
export async function renderMessage(prospectId: string, templateId: string) {
  const { data } = await api.get<{ body: string; templateName: string; phone: string | null }>(
    `/crm/prospects/${prospectId}/message`,
    { params: { templateId } },
  );
  return data;
}

export interface ProspectCountry {
  code: string;
  name: string;
  dial: string;
  flag: string;
  count: number;
}

/** Pays presents dans le CRM, deduits de l'indicatif telephonique. */
export async function listProspectCountries() {
  const { data } = await api.get<{ countries: ProspectCountry[] }>('/crm/countries');
  return data.countries;
}

/** Message e-mail pret a envoyer (objet + corps), variables deja remplacees. */
export async function renderEmail(prospectId: string, templateId: string) {
  const { data } = await api.get<{
    subject: string;
    body: string;
    templateName: string;
    email: string | null;
  }>(`/crm/prospects/${prospectId}/email`, { params: { templateId } });
  return data;
}
