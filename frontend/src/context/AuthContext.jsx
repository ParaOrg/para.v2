import { createContext, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth } from '../firebase';

const AuthContext = createContext(null);

const googleProvider = new GoogleAuthProvider();

// Mimics the Firebase User shape so UI components don't need a separate
// "no user yet" branch -- used both when Firebase isn't configured and
// when no one is signed in.
const GUEST_USER = {
  uid: 'guest_mode_active',
  displayName: 'Guest Commuter',
  email: 'guest@paraph.local',
  isAnonymous: true,
  isGuest: true,
  photoURL: null,
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // firebase.js sets auth to null when VITE_FIREBASE_* isn't configured.
    if (!auth) {
      setUser(GUEST_USER);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ? { ...firebaseUser, isGuest: false } : GUEST_USER);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const requireAuth = () => {
    if (!auth) throw new Error('Authentication is currently disabled in this environment.');
  };

  const login = (email, password) => {
    requireAuth();
    return signInWithEmailAndPassword(auth, email, password);
  };

  const loginWithGoogle = () => {
    requireAuth();
    return signInWithPopup(auth, googleProvider);
  };

  const requestPasswordReset = (email) => {
    requireAuth();
    return sendPasswordResetEmail(auth, email);
  };

  // Used after OTP verification — backend returns a custom token
  const loginWithCustomToken = (token) => {
    requireAuth();
    return signInWithCustomToken(auth, token);
  };

  const logout = () => {
    if (!auth) {
      setUser(GUEST_USER);
      return Promise.resolve();
    }
    return signOut(auth);
  };

  // Get fresh ID token for API calls
  const getIdToken = () => (user && !user.isGuest ? user.getIdToken() : null);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isGuest: user?.isGuest ?? true,
        login,
        loginWithGoogle,
        requestPasswordReset,
        logout,
        loginWithCustomToken,
        getIdToken,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
