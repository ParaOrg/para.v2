import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Tests must never touch real Firebase/Supabase/network services -- mock them
// at the module boundary so any component that transitively imports
// src/firebase.js or supabase.js gets safe no-op stand-ins.
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  useDeviceLanguage: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  onAuthStateChanged: vi.fn(() => () => {}),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithCustomToken: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({})),
}));
