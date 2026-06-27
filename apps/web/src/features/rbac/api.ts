import { api } from '../../lib/api';
import type { UserCreateInput } from '@oculo/shared-types';

export interface RoleDto {
  id: string;
  code: string;
  name: string;
  isSystem: boolean;
  isCustom: boolean;
  allBranches: boolean;
  userCount: number;
  permissions: string[];
}

export interface PermissionDef {
  module: string;
  action: string;
  label: string;
}

export async function listPermissions() {
  const { data } = await api.get<{
    permissions: PermissionDef[];
    grouped: Record<string, { key: string; action: string; label: string }[]>;
  }>('/rbac/permissions');
  return data;
}

export async function listRoles(): Promise<RoleDto[]> {
  const { data } = await api.get<{ roles: RoleDto[] }>('/rbac/roles');
  return data.roles;
}

export async function createRole(name: string, permissions: string[]) {
  const { data } = await api.post('/rbac/roles', { name, permissions });
  return data.role;
}

export async function updateRole(id: string, input: { name?: string; permissions?: string[] }) {
  const { data } = await api.patch(`/rbac/roles/${id}`, input);
  return data.role;
}

export async function deleteRole(id: string) {
  await api.delete(`/rbac/roles/${id}`);
}

export interface UserDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string | null;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  role: { id: string; name: string; code: string };
  branches: { id: string; name: string }[];
}

export async function listUsers(): Promise<UserDto[]> {
  const { data } = await api.get<{ users: UserDto[] }>('/users');
  return data.users;
}

export async function createUser(input: UserCreateInput) {
  const { data } = await api.post('/users', input);
  return data.user;
}

export async function deactivateUser(id: string) {
  await api.post(`/users/${id}/deactivate`);
}
