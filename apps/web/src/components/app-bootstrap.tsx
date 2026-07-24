import { useEffect, useState } from "react";

import { trpcClient } from "../clients/trpc";
import { authClient } from "../lib/auth-client";
import { redirectAppToSignIn } from "../lib/app-redirect";

type CreditBalance = Awaited<
  ReturnType<typeof trpcClient.credits.getBalance.query>
>;

type CreditBalanceState =
  | { status: "loading" }
  | { status: "redirecting" }
  | { status: "error" }
  | { status: "success"; balance: CreditBalance };

export function AppBootstrap() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <p>Resolving session...</p>;
  }

  if (!session) {
    return <SignedOutRedirect />;
  }

  return <AuthenticatedBootstrap email={session.user.email} />;
}

function SignedOutRedirect() {
  useEffect(() => {
    redirectAppToSignIn();
  }, []);

  return <p>Redirecting to sign in...</p>;
}

function AuthenticatedBootstrap({ email }: { email: string }) {
  const [attempt, setAttempt] = useState(0);
  const [balanceState, setBalanceState] = useState<CreditBalanceState>({
    status: "loading",
  });

  useEffect(() => {
    const abortController = new AbortController();
    setBalanceState({ status: "loading" });

    void trpcClient.credits.getBalance
      .query(undefined, { signal: abortController.signal })
      .then((balance) => {
        if (!abortController.signal.aborted) {
          setBalanceState({ status: "success", balance });
        }
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted) {
          return;
        }

        if (isUnauthorizedError(error)) {
          setBalanceState({ status: "redirecting" });
          redirectAppToSignIn();
          return;
        }

        setBalanceState({ status: "error" });
      });

    return () => {
      abortController.abort();
    };
  }, [attempt]);

  return (
    <>
      <p>Signed in as {email}</p>
      {balanceState.status === "loading" ? (
        <p>Loading credit balance...</p>
      ) : null}
      {balanceState.status === "redirecting" ? (
        <p>Redirecting to sign in...</p>
      ) : null}
      {balanceState.status === "error" ? (
        <>
          <p>Unable to load credit balance.</p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry
          </button>
        </>
      ) : null}
      {balanceState.status === "success" ? (
        <>
          <p>
            Available credit balance:{" "}
            {balanceState.balance.availableCreditAmountUsdMicros}
          </p>
          <p>
            Reserved credit balance:{" "}
            {balanceState.balance.reservedCreditAmountUsdMicros}
          </p>
        </>
      ) : null}
    </>
  );
}

function isUnauthorizedError(error: unknown) {
  if (!error || typeof error !== "object" || !("data" in error)) {
    return false;
  }

  const data = error.data;

  if (!data || typeof data !== "object" || !("code" in data)) {
    return false;
  }

  return data.code === "UNAUTHORIZED";
}
