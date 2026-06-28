import { api } from '../../lib/api';
import type {
  EmployeeCreateInput,
  EmployeeUpdateInput,
  ExpenseCreateInput,
  ExpenseUpdateInput,
  SupplierCreateInput,
  SupplierUpdateInput,
  InsurerCreateInput,
  InsurerUpdateInput,
} from '@oculo/shared-types';

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  position: string;
  salary: string | null;
  hireDate: string | null;
  status: string;
  branchId: string | null;
}
export interface Expense {
  id: string;
  category: string;
  label: string;
  amount: string;
  date: string;
  notes: string | null;
}
export interface Supplier {
  id: string;
  name: string;
  type: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
}
export interface Insurer {
  id: string;
  name: string;
  type: string;
  coveragePercent: number;
  phone: string | null;
  email: string | null;
  notes: string | null;
}
export interface FinanceSummary {
  monthRevenue: number;
  monthExpenses: number;
  net: number;
  byCategory: { category: string; total: number }[];
}

// Employees
export async function listEmployees(): Promise<Employee[]> {
  const { data } = await api.get<{ employees: Employee[] }>('/employees');
  return data.employees;
}
export async function createEmployee(input: EmployeeCreateInput) {
  const { data } = await api.post('/employees', input);
  return data.employee as Employee;
}
export async function updateEmployee(id: string, input: EmployeeUpdateInput) {
  const { data } = await api.patch(`/employees/${id}`, input);
  return data.employee as Employee;
}

// Expenses
export async function listExpenses(): Promise<Expense[]> {
  const { data } = await api.get<{ expenses: Expense[] }>('/expenses');
  return data.expenses;
}
export async function getFinanceSummary(): Promise<FinanceSummary> {
  const { data } = await api.get<FinanceSummary>('/expenses/summary');
  return data;
}
export async function createExpense(input: ExpenseCreateInput) {
  const { data } = await api.post('/expenses', input);
  return data.expense as Expense;
}
export async function updateExpense(id: string, input: ExpenseUpdateInput) {
  const { data } = await api.patch(`/expenses/${id}`, input);
  return data.expense as Expense;
}
export async function deleteExpense(id: string) {
  await api.delete(`/expenses/${id}`);
}

// Suppliers
export async function listSuppliers(): Promise<Supplier[]> {
  const { data } = await api.get<{ suppliers: Supplier[] }>('/suppliers');
  return data.suppliers;
}
export async function createSupplier(input: SupplierCreateInput) {
  const { data } = await api.post('/suppliers', input);
  return data.supplier as Supplier;
}
export async function updateSupplier(id: string, input: SupplierUpdateInput) {
  const { data } = await api.patch(`/suppliers/${id}`, input);
  return data.supplier as Supplier;
}

// Insurers
export async function listInsurers(): Promise<Insurer[]> {
  const { data } = await api.get<{ insurers: Insurer[] }>('/insurance');
  return data.insurers;
}
export async function createInsurer(input: InsurerCreateInput) {
  const { data } = await api.post('/insurance', input);
  return data.insurer as Insurer;
}
export async function updateInsurer(id: string, input: InsurerUpdateInput) {
  const { data } = await api.patch(`/insurance/${id}`, input);
  return data.insurer as Insurer;
}
