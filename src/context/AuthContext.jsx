import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "../utils/supabase";
import { getApiBaseUrl } from "../utils/api";

const AuthContext = createContext(null);
const PROFILE_CACHE_KEY = "para_profile_v1";

function readCachedProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) || "null");
  } catch {
    return null;
  }
}

function writeCachedProfile(profile) {
  try {
    if (profile) {
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
    } else {
      localStorage.removeItem(PROFILE_CACHE_KEY);
    }
  } catch {}
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(() => readCachedProfile());
  const [loading, setLoading] = useState(true);

  // Fetch profiles row for a user. Returns the row (or null).
  // Never throws — logs and returns null on error so callers can fall back
  // to cached/user_metadata data.
  const fetchProfileFor = useCallback(async (u) => {
    if (!u?.id) return null;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", u.id)
      .maybeSingle();
    if (error) {
      console.warn("[auth] fetchProfile failed:", error.message);
      return null;
    }
    return data;
  }, []);

  useEffect(() => {
    // Legacy cache cleanup from pre-Supabase era
    try {
      localStorage.removeItem("para_user");
      localStorage.removeItem("para_auth_user_v1");
    } catch {}

    let cancelled = false;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      const u = session?.user || null;
      setUser(u);

      // Unblock rendering immediately. Profile fetch happens in background.
      setLoading(false);

      if (u) {
        // Only use cache if it belongs to the same user
        const cached = readCachedProfile();
        if (cached?.id === u.id) {
          setProfile(cached);
        }

        // Refresh from server in the background (non-blocking)
        fetchProfileFor(u).then((p) => {
          if (cancelled) return;
          if (p) {
            setProfile(p);
            writeCachedProfile(p);
          }
        });
      } else {
        setProfile(null);
        writeCachedProfile(null);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (cancelled) return;
        const u = session?.user || null;
        setUser(u);
        setLoading(false);

        if (u) {
          const cached = readCachedProfile();
          if (cached?.id === u.id) {
            setProfile(cached);
          }
          fetchProfileFor(u).then((p) => {
            if (cancelled) return;
            if (p) {
              setProfile(p);
              writeCachedProfile(p);
            }
          });
        } else {
          setProfile(null);
          writeCachedProfile(null);
        }
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [fetchProfileFor]);

  const login = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // Clear cached profile from any previous session so it doesn't leak
    writeCachedProfile(null);
    return data.user;
  }, []);

  const signup = useCallback(async (email, password, name, extraMetadata = {}) => {
    try { await supabase.auth.signOut(); } catch {}
    writeCachedProfile(null);

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
    setProfile(null);
    writeCachedProfile(null);
  }, []);

  const checkPermission = useCallback((requiredPermission) => {
    if (!user) return false;
    return true;
  }, [user]);

  const updateProfile = useCallback(async (updates) => {
    if (!user?.id) throw new Error("Not signed in");

    // Strip role — RLS blocks it server-side anyway
    const { role: _ignored, ...safe } = updates;

    const { data, error } = await supabase
      .from("profiles")
      .update(safe)
      .eq("id", user.id)
      .select()
      .single();

    if (error) throw error;
    setProfile(data);
    writeCachedProfile(data);
    return data;
  }, [user]);

  const updateHandle = useCallback(async (newHandle, newName) => {
    if (!user) throw new Error("Not signed in");
    const API = getApiBaseUrl();
    const res = await fetch(`${API}/auth/username`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, handle: newHandle, name: newName }),
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Server returned non-JSON response (HTTP ${res.status})`);
    }

    if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
    if (data.status === "error") throw new Error(data.message || "Failed to update handle");

    const p = await fetchProfileFor(user);
    if (p) {
      setProfile(p);
      writeCachedProfile(p);
    }
    return data;
  }, [user, fetchProfileFor]);

  const updateEmail = useCallback(async (newEmail) => {
    const { data, error } = await supabase.auth.updateUser(
      { email: newEmail },
      { emailRedirectTo: `${window.location.origin}/profile/edit?emailChanged=1` }
    );
    if (error) throw error;
    return data.user;
  }, []);

  const phoneExists = useCallback(async (phone) => {
    const { data, error } = await supabase.rpc("phone_exists", { check_phone: phone });
    if (error) {
      console.warn("[phoneExists] RPC failed:", error.message);
      return false;
    }
    return Boolean(data);
  }, []);

  // Effective role: prefer profiles.role, fall back to user_metadata.role,
  // then to "commuter". Keeps old sessions working during the transition.
  const role =
    profile?.role ||
    user?.user_metadata?.role ||
    "commuter";

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      role,
      loading,
      isAuthenticated: !!user,
      isGuest: !user,
      login, signup, logout, checkPermission, loginWithCustomToken,
      updateProfile, updateHandle, updateEmail, phoneExists,
      refetchProfile: () => fetchProfileFor(user),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
