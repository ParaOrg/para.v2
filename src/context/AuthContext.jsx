import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getApiBaseUrl } from "../utils/api";
import { claimContributions, getPendingContributions } from "../utils/guestLink";

const AuthContext = createContext(null);
const USER_KEY = "para_auth_user_v1";
const TOKEN_KEY = "para_auth_token_v1";
const API = getApiBaseUrl();

function safeParse(value) { try { return value ? JSON.parse(value) : null; } catch { return null; } }

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => safeParse(localStorage.getItem(USER_KEY)));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check existing session
    const storedUser = safeParse(localStorage.getItem(USER_KEY));
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedUser && storedToken) {
      setUser(storedUser);
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email) => {
    const res = await fetch("https://tcvomrkytxnetzijwqad.supabase.co/functions/v1/auth-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    
    if (data.user) {
      setUser(data.user);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      
      // Claim guest contributions
      try {
        const pendingCount = getPendingContributions().length;
        if (pendingCount > 0 && data.user?.id) {
          await claimContributions(data.user.id, data.user.email || email);
        }
      } catch {}
    }
    
    return data;
  }, []);

  const signup = useCallback(async (email, name) => {
    const res = await fetch("https://tcvomrkytxnetzijwqad.supabase.co/functions/v1/auth-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    });
    const data = await res.json();
    
    if (data.user) {
      setUser(data.user);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      
      // Claim guest contributions after signup
      try {
        const pendingCount = getPendingContributions().length;
        if (pendingCount > 0 && data.user?.id) {
          await claimContributions(data.user.id, data.user.email || email);
        }
      } catch {}
    }
    
    return data;
  }, []);

  const loginWithCustomToken = useCallback(async (customToken) => {
    return login(customToken);
  }, [login]);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
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
