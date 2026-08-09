import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  getMe,
  logout as clearStoredSession,
  refreshSession,
} from "../services/authService";
import { registerCurrentDeviceForPush } from "../services/notificationService";

const AuthContext = createContext(null);

function getEmptySession() {
  return {
    user: null,
    memberships: [],
    currentOrganization: null,
  };
}

function buildSession(me) {
  const memberships = me?.memberships ?? [];
  const activeMembership =
    memberships.find((membership) => membership.status === "active") ??
    memberships[0] ??
    null;

  return {
    user: me?.user ?? null,
    memberships,
    currentOrganization: activeMembership?.organization ?? null,
  };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(getEmptySession);
  const [isLoading, setIsLoading] = useState(false);

  const loadSession = useCallback(async () => {
    setIsLoading(true);

    try {
      const tokens = await refreshSession();

      if (!tokens?.access) {
        setSession(getEmptySession());
        return null;
      }

      const me = await getMe();

      if (!me?.user) {
        setSession(getEmptySession());
        return null;
      }

      const nextSession = buildSession(me);
      setSession(nextSession);
      registerCurrentDeviceForPush().catch(() => {});
      return nextSession;
    } catch {
      await clearStoredSession();
      setSession(getEmptySession());
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await clearStoredSession();
    setSession(getEmptySession());
  }, []);

  const updateSessionUser = useCallback((user) => {
    setSession((currentSession) => ({
      ...currentSession,
      user,
    }));
  }, []);

  const value = useMemo(
    () => ({
      ...session,
      isAuthenticated: Boolean(session.user),
      isLoading,
      loadSession,
      signOut,
      updateSessionUser,
    }),
    [isLoading, loadSession, session, signOut, updateSessionUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  }

  return context;
}
