import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "../utils/supabase";
import { getApiBaseUrl } from "../utils/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // One-time migration: purge legacy cache keys from the pre-Supabase era.
    try {
      localStorage.removeItem("para_user");
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

  const signup = useCallback(async (email, password, name, extraMetadata = {}) => {
    try { await supabase.auth.signOut(); } catch {}

    const userMetadata = {
      full_name: name || email?.split("@")[0] || "",
      ...extraMetadata,
    };

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userMetadata,
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    if (error) throw error;

    const needsConfirmation = !data.session && !!data.user;
    return { user: data.user, needsConfirmation };
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

  // --- Profile update methods ---

  /**
   * Update arbitrary user_metadata fields.
   * @param {object} updates - e.g. { full_name, bio, role, contact }
   */
  const updateProfile = useCallback(async (updates) => {
    const { data, error } = await supabase.auth.updateUser({ data: updates });
    if (error) throw error;
    setUser(data.user);
    return data.user;
  }, []);

  /**
   * Update handle via the backend API (enforces uniqueness server-side).
   */
  const updateHandle = useCallback(async (newHandle, newName) => {
    if (!user) throw new Error("Not signed in");
    // Uses the same backend base URL as the rest of the app
    // (https://para-ph-api.onrender.com in production).
    const API = getApiBaseUrl();
    const res = await fetch(`${API}/auth/username`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, handle: newHandle, name: newName }),
    });

    // Guard against HTML responses (Vercel 404 page, proxy error, etc.)
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Server returned non-JSON response (HTTP ${res.status})`);
    }

    if (!res.ok) {
      throw new Error(data?.message || `HTTP ${res.status}`);
    }
    if (data.status === "error") {
      throw new Error(data.message || "Failed to update handle");
    }
    return data;
  }, [user]);

  /**
   * Update email. Supabase sends a confirmation link to the new email.
   * The change does NOT take effect until the link is clicked.
   */
  const updateEmail = useCallback(async (newEmail) => {
    const { data, error } = await supabase.auth.updateUser(
      { email: newEmail },
      { emailRedirectTo: `${window.location.origin}/profile/edit?emailChanged=1` }
    );
    if (error) throw error;
    return data.user;
  }, []);

  /**
   * Check if a phone number is already registered (via RPC).
   */
  const phoneExists = useCallback(async (phone) => {
    const { data, error } = await supabase.rpc("phone_exists", { check_phone: phone });
    if (error) {
      console.warn("[phoneExists] RPC failed:", error.message);
      return false; // Fail open — the trigger will catch it on save
    }
    return Boolean(data);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, setUser, loading,
      isAuthenticated: !!user,
      isGuest: !user,
      login, signup, logout, checkPermission, loginWithCustomToken,
      updateProfile, updateHandle, updateEmail, phoneExists,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
