import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "../utils/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // One-time migration: purge legacy cache keys from the pre-Supabase era.
    // These are the root cause of "shows wrong user after fresh signup" bugs.
    try {
      localStorage.removeItem("para_user");
      // para_auth_user_v1 is unconditionally removed — Profile no longer reads it.
      localStorage.removeItem("para_auth_user_v1");
    } catch {}

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  }, []);

  const signup = useCallback(async (email, password, name) => {
    // Clear any prior session so a stale token doesn't get restored
    // and make the freshly-signed-up user look like the previous one.
    try { await supabase.auth.signOut(); } catch {}

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name || email?.split("@")[0] || "" },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    if (error) throw error;

    // When email confirmation is enabled, `session` is null and user
    // must confirm before they can log in. Surface this to the caller.
    const needsConfirmation = !data.session && !!data.user;

    return {
      user: data.user,
      needsConfirmation,
    };
  }, []);

  const loginWithCustomToken = useCallback(async (customToken) => {
    return login(customToken, "");
  }, [login]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
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
