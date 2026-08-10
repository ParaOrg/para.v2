import { createContext, useState, useContext, useCallback } from "react";
import { getApiBaseUrl } from "../utils/api";

const API = getApiBaseUrl();
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const isAuthenticated = !!user;
  const isGuest = !user;

  const login = useCallback(async (email, _password) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (data.status === "success" || data.status === "exists") {
        setUser({
          uid: data.user?.user_id || email,
          email: email.trim().toLowerCase(),
          displayName: data.user?.name || email.split("@")[0],
          role: "user",
          isGuest: false,
        });
      }
    } catch (e) {
      console.error("Login failed:", e);
    }
    setLoading(false);
  }, []);

  const signup = useCallback(async (email, _password) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (data.status === "success" || data.status === "exists") {
        setUser({
          uid: data.user?.user_id || email,
          email: email.trim().toLowerCase(),
          displayName: data.user?.name || email.split("@")[0],
          role: "user",
          isGuest: false,
        });
      }
    } catch (e) {
      console.error("Signup failed:", e);
    }
    setLoading(false);
  }, []);

  const logout = useCallback(() => setUser(null), []);

  const checkPermission = useCallback((level) => {
    if (level === "admin") return user?.role === "admin";
    return isAuthenticated;
  }, [user, isAuthenticated]);

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated, isGuest, login, signup, logout, checkPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
