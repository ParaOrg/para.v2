const DEV_DEFAULT_API_BASE = 'http://localhost:8000';

export function getApiBaseUrl() {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? '').trim();
  if (fromEnv) {
    return fromEnv;
  }

  if (import.meta.env.DEV) {
    return DEV_DEFAULT_API_BASE;
  }

  return '';
}
