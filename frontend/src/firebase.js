import { initializeApp } from 'firebase/app';
import { getAuth, useDeviceLanguage } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const apiKey = String(firebaseConfig.apiKey ?? '');
const looksLikeFirebasePlaceholder =
  !apiKey ||
  /your-web-api-key|^your-[a-z-]+$/i.test(apiKey.trim()) ||
  /^<.*>$/.test(apiKey);

if (import.meta.env.DEV && looksLikeFirebasePlaceholder) {
  console.error(
    '[Firebase] VITE_FIREBASE_* is missing or still a template value. ' +
      'This app expects src/frontend/.env.frontend.dev (run `npm run dev`, which uses Vite mode frontend.dev). ' +
      'Or copy that file to .env.development. ' +
      'Get keys from Firebase Console → Project settings → Your apps → Web app config.'
  );
}

let app;
try {
  app = initializeApp(firebaseConfig);
} catch (e) {
  console.error('[Firebase] initializeApp failed:', e);
  throw e;
}

let auth;
try {
  auth = getAuth(app);
  useDeviceLanguage(auth);
} catch (e) {
  console.error(
    '[Firebase] getAuth failed (often invalid-api-key when env vars did not load). ' +
      'Fix: use `npm run dev` from src/frontend so --mode frontend.dev loads .env.frontend.dev.',
    e
  );
  throw e;
}

export { auth };
export default app;
