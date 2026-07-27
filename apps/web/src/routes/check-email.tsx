import { trpcClient } from "@/clients/trpc";
import { authClient } from "@/lib/auth-client";
import { parseCheckEmailSearch } from "@/lib/check-email";
import { AuthCard, Button, FieldError } from "@remora/ui";
import { createFileRoute } from "@tanstack/react-router";
import { CircleCheck, Loader2, MailCheck } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { createSeoHead } from "../lib/seo";

type PromotionStatus =
  | "eligible"
  | "none"
  | "redeemed"
  | "verification_required";

export const Route = createFileRoute("/check-email")({
  validateSearch: parseCheckEmailSearch,
  component: CheckEmail,
  head: () =>
    createSeoHead({
      canonicalPath: "/check-email",
      description: "Verify your Remora email address.",
      index: false,
      title: "Check your email",
    }),
});

function CheckEmail() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const {
    data: session,
    isPending: isSessionPending,
    refetch: refetchSession,
  } = authClient.useSession();
  const [promotionStatus, setPromotionStatus] =
    useState<PromotionStatus | null>(null);
  const [isStatusPending, setIsStatusPending] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const initialSendStarted = useRef(false);
  const refreshInFlight = useRef(false);

  const returnToApp = useCallback(async () => {
    await navigate({
      to: "/app",
      search: {},
      replace: true,
    });
  }, [navigate]);

  const loadPromotionStatus = useCallback(async () => {
    setErrorMessage(null);
    setIsStatusPending(true);

    try {
      const promotion = await trpcClient.promotion.getStatus.query();
      setPromotionStatus(promotion.status);

      if (
        !search.verified &&
        (promotion.status === "eligible" ||
          promotion.status === "redeemed" ||
          promotion.status === "none")
      ) {
        await returnToApp();
      }

      return promotion.status;
    } catch {
      setErrorMessage("Unable to check your verification status. Try again.");
      return null;
    } finally {
      setIsStatusPending(false);
    }
  }, [returnToApp, search.verified]);

  const sendVerificationEmail = useCallback(async () => {
    if (!session?.user.email || isSending) {
      return false;
    }

    setErrorMessage(null);
    setIsSending(true);
    let retryAfter: string | null = null;

    try {
      const result = await authClient.sendVerificationEmail({
        email: session.user.email,
        callbackURL: new URL(
          "/check-email?verified=true",
          window.location.origin,
        ).toString(),
        fetchOptions: {
          onError(context) {
            retryAfter = context.response.headers.get("x-retry-after");
          },
        },
      });

      if (result.error) {
        if (result.error.status === 429) {
          setErrorMessage(
            retryAfter
              ? `Too many verification emails were requested. Try again in ${retryAfter} seconds.`
              : "Too many verification emails were requested. Try again shortly.",
          );
        } else {
          setErrorMessage(
            "We couldn't send the verification email. Try again.",
          );
        }

        return false;
      }

      return true;
    } catch {
      setErrorMessage("We couldn't send the verification email. Try again.");
      return false;
    } finally {
      setIsSending(false);
    }
  }, [isSending, session?.user.email]);

  useEffect(() => {
    if (
      !session ||
      isSessionPending ||
      (search.verified && search.error !== undefined)
    ) {
      return;
    }

    void loadPromotionStatus();
  }, [
    isSessionPending,
    loadPromotionStatus,
    search.error,
    search.verified,
    session?.user.id,
  ]);

  useEffect(() => {
    if (
      search.send !== true ||
      promotionStatus !== "verification_required" ||
      initialSendStarted.current
    ) {
      return;
    }

    initialSendStarted.current = true;

    void sendVerificationEmail().finally(() => {
      void navigate({
        to: "/check-email",
        search: {},
        replace: true,
      });
    });
  }, [navigate, promotionStatus, search.send, sendVerificationEmail]);

  const refreshVerificationStatus = useCallback(
    async (showPendingMessage: boolean) => {
      if (refreshInFlight.current) {
        return;
      }

      refreshInFlight.current = true;
      setIsRefreshing(true);
      setErrorMessage(null);

      try {
        await refetchSession({
          query: {
            disableCookieCache: true,
          },
        });
        const status = await loadPromotionStatus();

        if (showPendingMessage && status === "verification_required") {
          setErrorMessage(
            "Your email is not verified yet. Open the link in the email, then try again.",
          );
        }
      } finally {
        refreshInFlight.current = false;
        setIsRefreshing(false);
      }
    },
    [loadPromotionStatus, refetchSession],
  );

  useEffect(() => {
    if (search.verified || promotionStatus !== "verification_required") {
      return;
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshVerificationStatus(false);
      }
    };

    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [promotionStatus, refreshVerificationStatus, search.verified]);

  function handleRefresh() {
    void refreshVerificationStatus(true);
  }

  const linkErrorMessage =
    search.error === "expired"
      ? "That verification link has expired."
      : search.error === "invalid"
        ? "That verification link is invalid."
        : null;

  if (search.verified) {
    return (
      <VerificationCallback
        hasSession={Boolean(session)}
        isSessionPending={isSessionPending}
        linkErrorMessage={linkErrorMessage}
        promotionStatus={promotionStatus}
        statusErrorMessage={errorMessage}
        onContinue={() => void returnToApp()}
        onReturnToVerification={() => {
          void navigate({
            to: "/check-email",
            search: {},
            replace: true,
          });
        }}
      />
    );
  }

  if (isSessionPending) {
    return <CheckEmailStatus>Resolving your session...</CheckEmailStatus>;
  }

  if (!session) {
    return (
      <CheckEmailShell>
        <AuthCard
          title="Sign in to verify your email"
          description="Sign in to resend the verification link and continue with your generation."
        >
          <Button
            className="w-full"
            onClick={() => {
              window.location.assign(
                `/sign-in?redirect=${encodeURIComponent("/check-email")}`,
              );
            }}
          >
            Sign in
          </Button>
        </AuthCard>
      </CheckEmailShell>
    );
  }

  if (
    promotionStatus === null ||
    isStatusPending ||
    promotionStatus === "eligible" ||
    promotionStatus === "redeemed"
  ) {
    return <CheckEmailStatus>Checking verification status...</CheckEmailStatus>;
  }

  if (promotionStatus === "none") {
    return (
      <CheckEmailShell>
        <AuthCard
          title="No verification needed"
          description="This account does not have a guest-generation promotion to verify."
        >
          <Button className="w-full" onClick={() => void returnToApp()}>
            Continue to Remora
          </Button>
        </AuthCard>
      </CheckEmailShell>
    );
  }

  const pendingLinkErrorMessage =
    search.error === "expired"
      ? "That verification link has expired. Send yourself a new one."
      : search.error === "invalid"
        ? "That verification link is invalid. Send yourself a new one."
        : null;

  return (
    <CheckEmailShell>
      <AuthCard
        title="Check your email"
        description={`Verify ${session.user.email} to finish creating your account.`}
      >
        <div className="flex flex-col gap-3">
          <div className="bg-muted text-muted-foreground flex items-start gap-3 rounded-md px-3 py-3 text-sm">
            <MailCheck className="mt-0.5 size-4 shrink-0" />
            <p>
              Open the verification link we sent you. The link expires in one
              hour.
            </p>
          </div>

          {pendingLinkErrorMessage ? (
            <FieldError className="border-destructive/20 bg-destructive/10 rounded-md border px-3 py-2">
              {pendingLinkErrorMessage}
            </FieldError>
          ) : null}

          {errorMessage ? (
            <FieldError className="border-destructive/20 bg-destructive/10 rounded-md border px-3 py-2">
              {errorMessage}
            </FieldError>
          ) : null}

          <Button
            className="w-full"
            disabled={isSending}
            onClick={() => void sendVerificationEmail()}
          >
            {isSending ? <Loader2 className="animate-spin" /> : null}
            Resend verification email
          </Button>
          <Button
            className="w-full"
            variant="outline"
            disabled={isRefreshing}
            onClick={handleRefresh}
          >
            {isRefreshing ? <Loader2 className="animate-spin" /> : null}
            I've verified my email
          </Button>
        </div>
      </AuthCard>
    </CheckEmailShell>
  );
}

function VerificationCallback({
  hasSession,
  isSessionPending,
  linkErrorMessage,
  promotionStatus,
  statusErrorMessage,
  onContinue,
  onReturnToVerification,
}: {
  hasSession: boolean;
  isSessionPending: boolean;
  linkErrorMessage: string | null;
  promotionStatus: PromotionStatus | null;
  statusErrorMessage: string | null;
  onContinue: () => void;
  onReturnToVerification: () => void;
}) {
  if (linkErrorMessage) {
    return (
      <VerificationCallbackError
        description={`${linkErrorMessage} Close this tab and request a new link from your original Remora tab.`}
        onReturnToVerification={onReturnToVerification}
      />
    );
  }

  if (isSessionPending) {
    return <CheckEmailStatus>Resolving your session...</CheckEmailStatus>;
  }

  if (!hasSession) {
    return (
      <CheckEmailShell>
        <AuthCard
          title="Unable to confirm verification"
          description="Return to your original Remora tab or sign in to check your email verification status."
        >
          <Button
            className="w-full"
            onClick={() => {
              window.location.assign(
                `/sign-in?redirect=${encodeURIComponent("/check-email")}`,
              );
            }}
          >
            Sign in
          </Button>
        </AuthCard>
      </CheckEmailShell>
    );
  }

  if (promotionStatus === "eligible" || promotionStatus === "redeemed") {
    return (
      <CheckEmailShell>
        <AuthCard
          title="Email verified"
          description="Your email address has been verified. You can close this tab and return to Remora."
        >
          <div className="flex flex-col gap-3">
            <div className="bg-muted text-muted-foreground flex items-start gap-3 rounded-md px-3 py-3 text-sm">
              <CircleCheck className="mt-0.5 size-4 shrink-0" />
              <p>
                Return to your original Remora tab to continue creating your
                account.
              </p>
            </div>
            <Button className="w-full" variant="outline" onClick={onContinue}>
              Continue in this tab
            </Button>
          </div>
        </AuthCard>
      </CheckEmailShell>
    );
  }

  if (promotionStatus === "verification_required") {
    return (
      <VerificationCallbackError
        description="We could not confirm this verification link. Close this tab and try again from your original Remora tab."
        onReturnToVerification={onReturnToVerification}
      />
    );
  }

  if (promotionStatus === "none") {
    return (
      <CheckEmailShell>
        <AuthCard
          title="No verification needed"
          description="This account does not have a guest-generation promotion to verify."
        >
          <Button className="w-full" onClick={onContinue}>
            Continue to Remora
          </Button>
        </AuthCard>
      </CheckEmailShell>
    );
  }

  if (statusErrorMessage) {
    return (
      <VerificationCallbackError
        title="Unable to confirm verification"
        description={`${statusErrorMessage} Return to your original Remora tab and try again.`}
        onReturnToVerification={onReturnToVerification}
      />
    );
  }

  return <CheckEmailStatus>Checking verification status...</CheckEmailStatus>;
}

function VerificationCallbackError({
  description,
  onReturnToVerification,
  title = "Email not verified",
}: {
  description: string;
  onReturnToVerification: () => void;
  title?: string;
}) {
  return (
    <CheckEmailShell>
      <AuthCard title={title} description={description}>
        <Button
          className="w-full"
          variant="outline"
          onClick={onReturnToVerification}
        >
          Return to verification
        </Button>
      </AuthCard>
    </CheckEmailShell>
  );
}

function CheckEmailStatus({ children }: { children: ReactNode }) {
  return (
    <CheckEmailShell>
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        {children}
      </div>
    </CheckEmailShell>
  );
}

function CheckEmailShell({ children }: { children: ReactNode }) {
  return (
    <main className="mp-block mp-no-track bg-background text-foreground flex min-h-svh items-center justify-center px-4 py-8 sm:px-6 md:py-10">
      <section className="w-full max-w-sm">{children}</section>
    </main>
  );
}
