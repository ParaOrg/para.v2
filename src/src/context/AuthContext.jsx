import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { apiGet, apiPost, setApiToken } from "../utils/api";

const AuthContext = createContext(null);

const TOKEN_KEY = "para_auth_token_v1";
const USER_KEY = "para_auth_user_v1";
const LEGACY_USER_KEY = "para_user";

function safeParse(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function readStoredUser() {
  const user = safeParse(localStorage.getItem(USER_KEY));
  return user && typeof user === "object" ? user : null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_USER_KEY);
    } catch {}

    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    setApiToken(token);

    let cancelled = false;

    apiGet("/api/v1/auth/me")
      .then((data) => {
        if (cancelled) return;

        const nextUser = data?.user || data;

        if (!nextUser || typeof nextUser !== "object") {
          throw new Error("Auth session is invalid.");
        }

        setUser(nextUser);

        try {
          localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
        } catch {}
      })
      .catch(() => {
        if (cancelled) return;

        try {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
        } catch {}

        setApiToken(null);
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setSession = useCallback((token, nextUser) => {
    if (!token) {
      throw new Error("Authentication succeeded but no token was returned.");
    }

    const safeUser =
      nextUser && typeof nextUser === "object" ? nextUser : {};

    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(safeUser));
    } catch {}

    setApiToken(token);
    setUser(safeUser);
  }, []);

  const clearSession = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {}

    setApiToken(null);
    setUser(null);
  }, []);

  const login = useCallback(
    async (email, password) => {
      const normalizedEmail = String(email || "").trim().toLowerCase();

      const data = await apiPost("/api/v1/auth/login", {
        email: normalizedEmail,
        password: password ?? "",
      });

      const token =
        data?.token ||
        data?.access_token ||
        data?.accessToken ||
        data?.jwt;

      const nextUser =
        data?.user ||
        data?.profile ||
        data?.account ||
        {
          email: normalizedEmail,
        };

      setSession(token, nextUser);

      return data;
    },
    [setSession]
  );

  const signup = useCallback(
    async (email, password) => {
      const normalizedEmail = String(email || "").trim().toLowerCase();

      const data = await apiPost("/api/v1/auth/register", {
        email: normalizedEmail,
        password: password ?? "",
      });

      const token =
        data?.token ||
        data?.access_token ||
        data?.accessToken ||
        data?.jwt;

      if (token) {
        const nextUser =
          data?.user ||
          data?.profile ||
          data?.account ||
          {
            email: normalizedEmail,
          };

        setSession(token, nextUser);
      }

      return data;
    },
    [setSession]
  );

  const loginWithCustomToken = useCallback(
    async (customToken) => {
      if (!customToken) {
        throw new Error("Missing custom authentication token.");
      }

      const data = await apiPost("/api/v1/auth/custom-token", {
        customToken,
      });

      const token =
        data?.token ||
        data?.access_token ||
        data?.accessToken ||
        data?.jwt;

      if (!token) {
        throw new Error("Custom token exchange failed.");
      }

      const nextUser =
        data?.user ||
        data?.profile ||
        data?.account ||
        {};

      setSession(token, nextUser);

      return data;
    },
    [setSession]
  );

  const logout = useCallback(() => {
    try {
      Promise.resolve(apiPost("/api/v1/auth/logout", {})).catch(() => {});
    } catch {}

    clearSession();
  }, [clearSession]);

  const isAuthenticated = Boolean(user);
  const isGuest = !user;

  const checkPermission = useCallback(
    (level) => {
      if (level === "admin") {
        return user?.role === "admin";
      }

      return isAuthenticated;
    },
    [user, isAuthenticated]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated,
        isGuest,
        login,
        signup,
        logout,
        checkPermission,
        loginWithCustomToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
