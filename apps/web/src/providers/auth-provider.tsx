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
  useState,
  type ReactNode,
} from "react";

import { authClient } from "../lib/auth-client";
import { redirectAppToSignIn } from "../lib/app-redirect";

export function AuthProvider({ children }: { children: ReactNode }) {
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
      image: session.user.image ?? null,
    };
  }, [
    session?.user.email,
    session?.user.id,
    session?.user.image,
    session?.user.name,
  ]);
  const status: AuthStatus =
    isPending && !hasResolvedSession
      ? "loading"
      : user
        ? "signed-in"
        : "signed-out";

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

      redirectAppToSignIn();
    } catch {
      setActionError("Unable to sign out.");
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      error:
        actionError ??
        formatAuthError(sessionError, "Unable to read the current session."),
      requestAuth,
      signOut,
    }),
    [actionError, requestAuth, sessionError, signOut, status, user],
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
