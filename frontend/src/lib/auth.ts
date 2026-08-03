const STORAGE_KEY = "railboard:admin-auth";

let cached: string | null = null;

export const AUTH_USERNAME = "admin";

export function getAuthToken(): string | null {
  if (cached) return cached;
  try {
    cached = sessionStorage.getItem(STORAGE_KEY);
  } catch {
    cached = null;
  }
  return cached;
}

export function setCredentials(username: string, password: string): void {
  cached = btoa(`${username}:${password}`);
  try {
    sessionStorage.setItem(STORAGE_KEY, cached);
  } catch {
    /* storage unavailable */
  }
}

export function clearCredentials(): void {
  cached = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function hasCredentials(): boolean {
  return Boolean(getAuthToken());
}

export function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Basic ${token}` } : {};
}