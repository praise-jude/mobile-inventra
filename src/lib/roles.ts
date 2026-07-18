import type { UserRole } from '@/types/database';

// Direct port of Inventra/lib/roles.ts — single source of truth for the
// Admin/Manager/Staff role tiers, kept in sync with the web app's copy.
export const ADMIN_ROLES: UserRole[] = ['owner', 'admin'];
export const MANAGER_ROLES: UserRole[] = ['owner', 'admin', 'manager'];

export function isAdminRole(role: UserRole | string): boolean {
  return (ADMIN_ROLES as string[]).includes(role);
}

export function isManagerRole(role: UserRole | string): boolean {
  return (MANAGER_ROLES as string[]).includes(role);
}
