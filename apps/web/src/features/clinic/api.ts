import { api } from '../../lib/api';
import type {
  PatientCreateInput,
  ConsultationCreateInput,
  AppointmentCreateInput,
  AppointmentUpdateInput,
  SurgeryCreateInput,
  SurgeryUpdateInput,
} from '@oculo/shared-types';

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  gender: string | null;
  dateOfBirth: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  bloodGroup: string | null;
  allergies: string | null;
  medicalHistory: string | null;
  createdAt: string;
}

export interface Consultation {
  id: string;
  patientId: string;
  date: string;
  visualAcuityRight: string | null;
  visualAcuityLeft: string | null;
  refractionRight: string | null;
  refractionLeft: string | null;
  tonometryRight: string | null;
  tonometryLeft: string | null;
  biomicroscopy: string | null;
  fundus: string | null;
  oct: string | null;
  visualField: string | null;
  diagnosis: string | null;
  prescription: string | null;
  notes: string | null;
  patient?: { firstName: string; lastName: string };
}

export interface Appointment {
  id: string;
  patientId: string;
  scheduledAt: string;
  reason: string | null;
  practitionerName: string | null;
  status: string;
  notes: string | null;
  patient?: { firstName: string; lastName: string; phone: string | null };
}

export interface Surgery {
  id: string;
  patientId: string;
  type: string;
  eye: string;
  surgeonName: string | null;
  scheduledAt: string | null;
  status: string;
  outcome: string | null;
  followUpNotes: string | null;
  patient?: { firstName: string; lastName: string };
}

// Patients
export async function listPatients(search?: string): Promise<Patient[]> {
  const { data } = await api.get<{ patients: Patient[] }>('/patients', { params: { search } });
  return data.patients;
}
export async function getPatient(id: string) {
  const { data } = await api.get(`/patients/${id}`);
  return data.patient as Patient & {
    consultations: Consultation[];
    appointments: Appointment[];
    surgeries: Surgery[];
  };
}
export async function createPatient(input: PatientCreateInput) {
  const { data } = await api.post('/patients', input);
  return data.patient as Patient;
}
export async function updatePatient(id: string, input: Partial<PatientCreateInput>) {
  const { data } = await api.patch(`/patients/${id}`, input);
  return data.patient as Patient;
}
export async function deletePatient(id: string) {
  await api.delete(`/patients/${id}`);
}

// Consultations
export async function listConsultations(patientId?: string): Promise<Consultation[]> {
  const { data } = await api.get<{ consultations: Consultation[] }>('/consultations', {
    params: { patientId },
  });
  return data.consultations;
}
export async function createConsultation(input: ConsultationCreateInput) {
  const { data } = await api.post('/consultations', input);
  return data.consultation as Consultation;
}

// Appointments
export async function listAppointments(params: { status?: string; from?: string; to?: string } = {}) {
  const { data } = await api.get<{ appointments: Appointment[] }>('/appointments', { params });
  return data.appointments;
}
export async function createAppointment(input: AppointmentCreateInput) {
  const { data } = await api.post('/appointments', input);
  return data.appointment as Appointment;
}
export async function updateAppointment(id: string, input: AppointmentUpdateInput) {
  const { data } = await api.patch(`/appointments/${id}`, input);
  return data.appointment as Appointment;
}

// Surgeries
export async function listSurgeries(params: { status?: string; patientId?: string } = {}) {
  const { data } = await api.get<{ surgeries: Surgery[] }>('/surgeries', { params });
  return data.surgeries;
}
export async function createSurgery(input: SurgeryCreateInput) {
  const { data } = await api.post('/surgeries', input);
  return data.surgery as Surgery;
}
export async function updateSurgery(id: string, input: SurgeryUpdateInput) {
  const { data } = await api.patch(`/surgeries/${id}`, input);
  return data.surgery as Surgery;
}
