import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "../utils/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name || email?.split("@")[0] || "" } },
    });
    if (error) throw error;
    return data.user;
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
