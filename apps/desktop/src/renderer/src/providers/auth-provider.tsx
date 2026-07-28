import {
  AuthProvider as SharedAuthProvider,
  type AuthContextValue,
  type AuthStatus,
} from "@remora/app/auth";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  authBridge,
  type AuthErrorContext,
  type AuthState,
} from "../lib/auth-bridge.ts";
import {
  identifyAnalyticsUser,
  initializeRendererAnalytics,
  resetAnalyticsUser,
  resumeRendererAnalytics,
  suppressRendererAnalytics,
  trackDesktopSessionStarted,
} from "../lib/analytics.ts";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const analyticsUserIdRef = useRef<string | null>(null);
  const identityKeyRef = useRef<string | null>(null);
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const user = authState?.user ?? null;
  const impersonatedBy = authState?.session.impersonatedBy ?? null;

  useEffect(() => {
    let isMounted = true;

    void authBridge
      .getState()
      .then((nextState) => {
        if (!isMounted) {
          return;
        }

        setAuthState(nextState);
        setStatus(nextState ? "signed-in" : "signed-out");
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setStatus("signed-out");
        setError("Unable to read the current session.");
      });

    const unsubscribeAuthenticated = authBridge.onAuthenticated((nextState) => {
      setAuthState(nextState);
      setStatus("signed-in");
      setError(null);
    });
    const unsubscribeUserUpdated = authBridge.onUserUpdated((nextState) => {
      setAuthState(nextState);
      setStatus(nextState ? "signed-in" : "signed-out");
    });
    const unsubscribeAuthError = authBridge.onAuthError((context) => {
      setError(formatAuthError(context));
    });

    return () => {
      isMounted = false;
      unsubscribeAuthenticated();
      unsubscribeUserUpdated();
      unsubscribeAuthError();
    };
  }, []);

  useEffect(() => {
    const identityKey = authState
      ? `${authState.user.id}:${authState.session.impersonatedBy ?? ""}`
      : null;

    if (identityKeyRef.current && identityKeyRef.current !== identityKey) {
      void queryClient.cancelQueries();
      queryClient.clear();
    }

    identityKeyRef.current = identityKey;
  }, [authState, queryClient]);

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (status === "signed-out" || !user || impersonatedBy) {
      suppressRendererAnalytics();
      analyticsUserIdRef.current = null;

      return;
    }

    initializeRendererAnalytics();
    resumeRendererAnalytics();

    if (analyticsUserIdRef.current === user.id) {
      return;
    }

    if (analyticsUserIdRef.current) {
      resetAnalyticsUser();
    }

    const identified = identifyAnalyticsUser(user.id);
    analyticsUserIdRef.current = user.id;

    if (identified) {
      trackDesktopSessionStarted();
    }
  }, [impersonatedBy, status, user]);

  const requestAuth = useCallback(async () => {
    setError(null);

    try {
      await authBridge.requestAuth();
    } catch {
      setError("Unable to open the sign-in flow.");
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);

    try {
      await authBridge.signOut();
      setAuthState(null);
      setStatus("signed-out");
    } catch {
      setError("Unable to sign out.");
    }
  }, []);

  const stopImpersonating = useCallback(async () => {
    setError(null);

    try {
      const nextState = await authBridge.stopImpersonating();
      setAuthState(nextState);
    } catch {
      setError("Unable to stop impersonating.");
      throw new Error("Unable to stop impersonating.");
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      impersonatedBy,
      status,
      error,
      requestAuth,
      signOut,
      stopImpersonating,
    }),
    [
      error,
      impersonatedBy,
      requestAuth,
      signOut,
      status,
      stopImpersonating,
      user,
    ],
  );

  return <SharedAuthProvider value={value}>{children}</SharedAuthProvider>;
}

function formatAuthError(context: AuthErrorContext) {
  return context.message ?? context.statusText ?? "Authentication failed.";
}
