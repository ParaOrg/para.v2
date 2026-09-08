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
    // Check existing session — if user exists in localStorage, restore it
    const storedUser = safeParse(localStorage.getItem(USER_KEY));
    const storedToken = localStorage.getItem(TOKEN_KEY);
    
    if (storedUser) {
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
      
      // Save token if present in response
      if (data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
      } else if (data.session?.access_token) {
        localStorage.setItem(TOKEN_KEY, data.session.access_token);
      } else if (data.access_token) {
        localStorage.setItem(TOKEN_KEY, data.access_token);
      } else {
        // No token in response — generate a session marker so user persists offline
        localStorage.setItem(TOKEN_KEY, "session-" + Date.now());
      }
      
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
      
      // Save token if present
      if (data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
      } else if (data.session?.access_token) {
        localStorage.setItem(TOKEN_KEY, data.session.access_token);
      } else if (data.access_token) {
        localStorage.setItem(TOKEN_KEY, data.access_token);
      } else {
        localStorage.setItem(TOKEN_KEY, "session-" + Date.now());
      }
      
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
