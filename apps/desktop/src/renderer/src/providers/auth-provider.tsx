import {
  AuthProvider as SharedAuthProvider,
  type AuthContextValue,
  type AuthStatus,
  type AuthUser,
} from "@remora/app/auth";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { authBridge, type AuthErrorContext } from "../lib/auth-bridge.ts";
import {
  identifyAnalyticsUser,
  resetAnalyticsUser,
  trackDesktopSessionStarted,
} from "../lib/analytics.ts";

export function AuthProvider({ children }: { children: ReactNode }) {
  const analyticsUserIdRef = useRef<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    void authBridge
      .getUser()
      .then((nextUser) => {
        if (!isMounted) {
          return;
        }

        setUser(nextUser);
        setStatus(nextUser ? "signed-in" : "signed-out");
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setStatus("signed-out");
        setError("Unable to read the current session.");
      });

    const unsubscribeAuthenticated = authBridge.onAuthenticated((nextUser) => {
      setUser(nextUser);
      setStatus("signed-in");
      setError(null);
    });
    const unsubscribeUserUpdated = authBridge.onUserUpdated((nextUser) => {
      setUser(nextUser);
      setStatus(nextUser ? "signed-in" : "signed-out");
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
    if (status === "loading") {
      return;
    }

    if (status === "signed-out" || !user) {
      if (analyticsUserIdRef.current) {
        resetAnalyticsUser();
        analyticsUserIdRef.current = null;
      }

      return;
    }

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
  }, [status, user]);

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
      setUser(null);
      setStatus("signed-out");
    } catch {
      setError("Unable to sign out.");
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      error,
      requestAuth,
      signOut,
    }),
    [error, requestAuth, signOut, status, user],
  );

  return <SharedAuthProvider value={value}>{children}</SharedAuthProvider>;
}

function formatAuthError(context: AuthErrorContext) {
  return context.message ?? context.statusText ?? "Authentication failed.";
}
