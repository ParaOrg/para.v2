import { afterEach, describe, expect, it } from 'vitest';
import { getApiBaseUrl } from './api';

describe('getApiBaseUrl', () => {
  const originalEnv = { ...import.meta.env };

  afterEach(() => {
    Object.assign(import.meta.env, originalEnv);
  });

  it('returns VITE_API_BASE_URL when set', () => {
    import.meta.env.VITE_API_BASE_URL = 'https://api.example.com';
    expect(getApiBaseUrl()).toBe('https://api.example.com');
  });

  it('falls back to VITE_API_URL when VITE_API_BASE_URL is unset', () => {
    // getApiBaseUrl() uses `??`, which only falls through on null/undefined,
    // not on an empty string -- so the key must be absent, not just empty.
    delete import.meta.env.VITE_API_BASE_URL;
    import.meta.env.VITE_API_URL = 'https://legacy.example.com';
    expect(getApiBaseUrl()).toBe('https://legacy.example.com');
  });

  it('prefers VITE_API_BASE_URL over VITE_API_URL when both are set', () => {
    import.meta.env.VITE_API_BASE_URL = 'https://primary.example.com';
    import.meta.env.VITE_API_URL = 'https://legacy.example.com';
    expect(getApiBaseUrl()).toBe('https://primary.example.com');
  });

  it('trims whitespace from the configured URL', () => {
    import.meta.env.VITE_API_BASE_URL = '  https://api.example.com  ';
    expect(getApiBaseUrl()).toBe('https://api.example.com');
  });

  it('falls back to the dev default when unset and DEV is true', () => {
    import.meta.env.VITE_API_BASE_URL = '';
    import.meta.env.VITE_API_URL = '';
    import.meta.env.DEV = true;
    expect(getApiBaseUrl()).toBe('http://localhost:8000');
  });

  it('returns an empty string when unset and not in dev mode', () => {
    import.meta.env.VITE_API_BASE_URL = '';
    import.meta.env.VITE_API_URL = '';
    import.meta.env.DEV = false;
    expect(getApiBaseUrl()).toBe('');
  });
});
