import {
  AuthProvider as SharedAuthProvider,
  type AuthContextValue,
  type AuthStatus,
  type AuthUser,
} from "@remora/app/auth";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import { authClient } from "../lib/auth-client";
import {
  identifyWebAnalyticsUser,
  resetWebAnalyticsUser,
} from "../lib/analytics";
import { redirectAppToSignIn } from "../lib/app-redirect";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const identityRef = useRef<string | null>(null);
  const {
    data: session,
    error: sessionError,
    isPending,
  } = authClient.useSession();
  const [hasResolvedSession, setHasResolvedSession] = useState(!isPending);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending) {
      setHasResolvedSession(true);
    }
  }, [isPending]);

  const user = useMemo<AuthUser | null>(() => {
    if (!session) {
      return null;
    }

    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role === "admin" ? "admin" : "user",
      image: session.user.image ?? null,
    };
  }, [
    session?.user.email,
    session?.user.id,
    session?.user.image,
    session?.user.role,
    session?.user.name,
  ]);
  const impersonatedBy = session?.session?.impersonatedBy ?? null;
  const status: AuthStatus =
    isPending && !hasResolvedSession
      ? "loading"
      : user
        ? "signed-in"
        : "signed-out";

  useEffect(() => {
    if (user && !impersonatedBy) {
      void identifyWebAnalyticsUser(user.id);
      return;
    }

    if (impersonatedBy) {
      resetWebAnalyticsUser();
    }
  }, [impersonatedBy, user]);

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    const identity = user ? `${user.id}:${impersonatedBy ?? ""}` : "signed-out";

    if (identityRef.current === null) {
      identityRef.current = identity;
      return;
    }

    if (identityRef.current === identity) {
      return;
    }

    identityRef.current = identity;
    void queryClient.cancelQueries();
    queryClient.clear();
  }, [impersonatedBy, queryClient, status, user]);

  const requestAuth = useCallback(async () => {
    setActionError(null);

    try {
      redirectAppToSignIn();
    } catch {
      setActionError("Unable to open the sign-in flow.");
    }
  }, []);

  const signOut = useCallback(async () => {
    setActionError(null);

    try {
      const result = await authClient.signOut();

      if (result.error) {
        setActionError(result.error.message ?? "Unable to sign out.");
        return;
      }

      resetWebAnalyticsUser();
      redirectAppToSignIn();
    } catch {
      setActionError("Unable to sign out.");
    }
  }, []);

  const stopImpersonating = useCallback(async () => {
    setActionError(null);

    const result = await authClient.admin.stopImpersonating();

    if (result.error) {
      const message =
        result.error.message ?? "Unable to stop impersonating this account.";
      setActionError(message);
      throw new Error(message);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      impersonatedBy,
      status,
      error:
        actionError ??
        formatAuthError(sessionError, "Unable to read the current session."),
      requestAuth,
      signOut,
      stopImpersonating,
    }),
    [
      actionError,
      impersonatedBy,
      requestAuth,
      sessionError,
      signOut,
      status,
      stopImpersonating,
      user,
    ],
  );

  return <SharedAuthProvider value={value}>{children}</SharedAuthProvider>;
}

function formatAuthError(error: unknown, fallback: string) {
  if (!error) {
    return null;
  }

  if (
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message
  ) {
    return error.message;
  }

  return fallback;
}
