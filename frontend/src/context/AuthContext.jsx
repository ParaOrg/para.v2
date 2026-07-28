import { createContext, useState, useEffect, useContext } from 'react';
import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";

// ==========================================
// 1. FIREBASE INITIALIZATION (WITH FALLBACK)
// ==========================================
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Check if Firebase is actually configured
const isFirebaseConfigured = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";

let auth = null;
if (isFirebaseConfigured) {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
  } catch (error) {
    console.warn("⚠️ Firebase initialization failed. Falling back to Guest Mode.", error);
  }
}

// ==========================================
// 2. GUEST USER FALLBACK
// ==========================================
// Mimics the Firebase User object so UI components don't crash
const GUEST_USER = {
  uid: 'guest_mode_active',
  displayName: 'Guest Commuter',
  email: 'guest@paraph.local',
  isAnonymous: true,
  isGuest: true, // Custom flag for easy UI checks
  photoURL: null,
};

// ==========================================
// 3. CONTEXT SETUP
// ==========================================
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If Firebase is NOT configured, inject Guest User immediately
    if (!isFirebaseConfigured || !auth) {
      setUser(GUEST_USER);
      setLoading(false);
      return;
    }

    // Standard Firebase Auth Listener
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        // Attach custom flag so UI knows it's a real user
        setUser({ ...currentUser, isGuest: false });
      } else {
        setUser(GUEST_USER); // Fallback to guest if logged out
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ==========================================
  // 4. AUTH METHODS
  // ==========================================
  const login = async (email, password) => {
    if (!auth) throw new Error("Authentication is currently disabled in this environment.");
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signup = async (email, password) => {
    if (!auth) throw new Error("Authentication is currently disabled in this environment.");
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    if (!auth) {
      setUser(GUEST_USER); // Just reset to guest if no Firebase
      return;
    }
    await signOut(auth);
  };

  const loginWithGoogle = async () => {
    if (!auth) throw new Error("Authentication is currently disabled in this environment.");
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  // ==========================================
  // 5. PROVIDER VALUE
  // ==========================================
  const value = {
    user,
    loading,
    isGuest: user?.isGuest || false,
    isFirebaseConfigured,
    login,
    signup,
    logout,
    loginWithGoogle
  };

  return (
    <AuthContext.Provider value={value}>
      {/* Prevent UI flash while checking auth state */}
      {!loading && children}
    </AuthContext.Provider>
  );
}

// ==========================================
// 6. CUSTOM HOOK
// ==========================================
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};