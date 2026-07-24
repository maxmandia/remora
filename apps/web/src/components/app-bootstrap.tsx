import { useAuth } from "@remora/app/auth";
import { useEffect, useState } from "react";

import { trpcClient } from "../clients/trpc";

type CreditBalance = Awaited<
  ReturnType<typeof trpcClient.credits.getBalance.query>
>;

type CreditBalanceState =
  | { status: "loading" }
  | { status: "redirecting" }
  | { status: "error" }
  | { status: "success"; balance: CreditBalance };

export function AppBootstrap() {
  const { requestAuth, status, user } = useAuth();

  if (status === "loading") {
    return <p>Resolving session...</p>;
  }

  if (status === "signed-out" || !user) {
    return <SignedOutRedirect requestAuth={requestAuth} />;
  }

  return (
    <AuthenticatedBootstrap email={user.email} requestAuth={requestAuth} />
  );
}

function SignedOutRedirect({
  requestAuth,
}: {
  requestAuth: () => Promise<void>;
}) {
  useEffect(() => {
    void requestAuth();
  }, [requestAuth]);

  return <p>Redirecting to sign in...</p>;
}

function AuthenticatedBootstrap({
  email,
  requestAuth,
}: {
  email: string;
  requestAuth: () => Promise<void>;
}) {
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
          void requestAuth();
          return;
        }

        setBalanceState({ status: "error" });
      });

    return () => {
      abortController.abort();
    };
  }, [attempt, requestAuth]);

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
