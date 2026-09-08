import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import { auth } from "../utils/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for auth state changes (login, logout, token refresh)
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          id: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "",
          handle: firebaseUser.displayName || "",
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email, password) => {
    const { user: firebaseUser } = await signInWithEmailAndPassword(auth, email, password);
    return firebaseUser;
  }, []);

  const signup = useCallback(async (email, password, name) => {
    const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, password);
    
    // Set display name
    if (name) {
      await updateProfile(firebaseUser, { displayName: name });
      setUser(prev => prev ? { ...prev, name, handle: name } : prev);
    }
    
    return firebaseUser;
  }, []);

  const loginWithCustomToken = useCallback(async (customToken) => {
    return login(customToken, "");
  }, [login]);

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
  }, []);

  const checkPermission = useCallback((requiredPermission) => {
    if (!user) return false;
    return true;
  }, [user]);

  return (
    <AuthContext.Provider value={{ 
      user, setUser, loading, 
      isAuthenticated: !!user, 
      isGuest: !user,
      login, signup, logout, checkPermission, loginWithCustomToken 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
