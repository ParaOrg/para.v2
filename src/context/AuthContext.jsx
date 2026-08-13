import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getApiBaseUrl } from "../utils/api";

const AuthContext = createContext(null);
const USER_KEY = "para_auth_user_v1";
const TOKEN_KEY = "para_auth_token_v1";
const API = getApiBaseUrl();

function safeParse(value) { try { return value ? JSON.parse(value) : null; } catch { return null; } }

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => safeParse(localStorage.getItem(USER_KEY)));
  const [loading, setLoading] = useState(true);

  useEffect(() => { setLoading(false); }, []);

  const login = useCallback(async (email) => {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) throw new Error("Email is required");

    const res = await fetch(`${API}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail }),
    });

    if (!res.ok) throw new Error("Sign in failed");
    const data = await res.json();

    if (data.status === "error") throw new Error(data.message || "Sign in failed");

    const userData = data.user || { email: normalizedEmail, name: normalizedEmail.split("@")[0] };
    try { localStorage.setItem(USER_KEY, JSON.stringify(userData)); } catch {}
    setUser(userData);
    return data;
  }, []);

  const signup = useCallback(async (email, name) => {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) throw new Error("Email is required");

    const res = await fetch(`${API}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail, name: name || normalizedEmail.split("@")[0] }),
    });

    if (!res.ok) throw new Error("Sign up failed");
    const data = await res.json();

    if (data.status === "error") throw new Error(data.message || "Sign up failed");

    const userData = data.user || { email: normalizedEmail, name };
    try { localStorage.setItem(USER_KEY, JSON.stringify(userData)); } catch {}
    setUser(userData);
    return data;
  }, []);

  const loginWithCustomToken = useCallback(async (customToken) => {
    // Backend doesn't have custom tokens — treat as email login
    return login(customToken);
  }, [login]);

  const logout = useCallback(() => {
    try { localStorage.removeItem(USER_KEY); localStorage.removeItem(TOKEN_KEY); } catch {}
    setUser(null);
  }, []);

  const isAuthenticated = Boolean(user);
  const isGuest = !user;
  const checkPermission = useCallback((level) => {
    if (level === "admin") return user?.role === "admin";
    return isAuthenticated;
  }, [user, isAuthenticated]);

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated, isGuest, login, signup, logout, checkPermission, loginWithCustomToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
