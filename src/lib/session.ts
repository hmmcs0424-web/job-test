import type { Staff } from './types';

const STAFF_KEY = 'job_test_staff';
const ADMIN_KEY = 'job_test_admin';

export function saveStaffSession(staff: Staff) {
  sessionStorage.setItem(STAFF_KEY, JSON.stringify(staff));
}

export function getStaffSession(): Staff | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(STAFF_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearStaffSession() {
  sessionStorage.removeItem(STAFF_KEY);
}

export function saveAdminSession() {
  sessionStorage.setItem(ADMIN_KEY, 'true');
}

export function getAdminSession(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(ADMIN_KEY) === 'true';
}

export function clearAdminSession() {
  sessionStorage.removeItem(ADMIN_KEY);
}
