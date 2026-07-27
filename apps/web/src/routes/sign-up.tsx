import { authClient } from "@/lib/auth-client";
import { continueWebAuth, parseAuthSearch } from "@/lib/auth-redirect";
import {
  getElectronFetchOptions,
  hasElectronAuthSearch,
  restartElectronRedirect,
  transferElectronUser,
  useElectronRedirect,
} from "@/lib/electron-auth";
import {
  guestGenerationHandoffService,
  runSignupWithGuestGeneration,
} from "@/lib/guest-generation-handoff";
import { linkGuestGenerationAnalyticsUser } from "@/lib/analytics";
import { trpcClient } from "@/clients/trpc";
import {
  AuthCard,
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@remora/ui";
import { FormTextField, useForm } from "@remora/form";
import { ClientOnly, createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { createSeoHead } from "../lib/seo";

const signUpSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Enter your name.")
      .max(80, "Name must be 80 characters or fewer."),
    email: z.string().trim().email("Enter a valid email address."),
    password: z
      .string()
      .min(8, "Use 8 characters or more.")
      .max(128, "Password must be 128 characters or fewer."),
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const Route = createFileRoute("/sign-up")({
  validateSearch: parseAuthSearch,
  component: SignUp,
  head: () =>
    createSeoHead({
      canonicalPath: "/sign-up",
      description: "Create a Remora account.",
      index: false,
      title: "Sign up",
    }),
});

function SignUp() {
  const authSearch = Route.useSearch();
  const { data: session, isPending } = authClient.useSession();
  const [serverError, setServerError] = useState<string | null>(null);
  const [guestPromotionTicket, setGuestPromotionTicket] = useState<
    string | null
  >(null);
  const [isGuestHandoffPending, setIsGuestHandoffPending] = useState(false);
  const isElectronAuth = hasElectronAuthSearch(authSearch);
  const isGuestGenerationSignup =
    authSearch.guestGeneration === true && !isElectronAuth;

  useElectronRedirect(authSearch);

  useEffect(() => {
    if (!session || isPending) {
      return;
    }

    void transferElectronUser(authSearch);
  }, [authSearch, isPending, session]);

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    validators: {
      onSubmit: signUpSchema,
    },
    onSubmit: async ({ value }) => {
      setServerError(null);

      let result: Awaited<ReturnType<typeof authClient.signUp.email>>;

      try {
        result = await runSignupWithGuestGeneration({
          claim: (ticket) => guestGenerationHandoffService.claim(ticket),
          createAccount: () =>
            authClient.signUp.email({
              name: value.name.trim(),
              email: value.email.trim(),
              password: value.password,
              fetchOptions: getElectronFetchOptions(authSearch),
            }),
          isAccountCreated: (accountResult) => !accountResult.error,
          isGuestGeneration: isGuestGenerationSignup,
          onAccountCreated: async (accountResult) => {
            if (accountResult.data?.user.id) {
              await linkGuestGenerationAnalyticsUser(
                accountResult.data.user.id,
              );
            }
          },
          onClaimed: continueToCheckEmail,
          onTicketResolved: setGuestPromotionTicket,
          resolveTicket: () => guestGenerationHandoffService.resolveTicket(),
        });
      } catch (error) {
        setServerError(formatHandoffError(error));
        return;
      }

      if (result.error) {
        setServerError(result.error.message ?? "Unable to create account.");
        return;
      }

      if (isGuestGenerationSignup) {
        return;
      }

      if (!isElectronAuth) {
        continueWebAuth(authSearch);
        return;
      }

      restartElectronRedirect(authSearch);
    },
  });

  async function completeGuestHandoff(ticket = guestPromotionTicket) {
    setServerError(null);
    setIsGuestHandoffPending(true);

    try {
      if (session?.user.id) {
        await linkGuestGenerationAnalyticsUser(session.user.id);
      }

      if (!ticket) {
        const promotion = await trpcClient.promotion.getStatus.query();

        if (promotion.status === "verification_required") {
          continueToCheckEmail();
          return;
        }

        if (
          promotion.status === "eligible" ||
          promotion.status === "redeemed"
        ) {
          continueWebAuth(authSearch);
          return;
        }

        ticket = await guestGenerationHandoffService.resolveTicket();
        setGuestPromotionTicket(ticket);
      }

      await guestGenerationHandoffService.claim(ticket);
      continueToCheckEmail();
    } catch (error) {
      setServerError(formatHandoffError(error));
    } finally {
      setIsGuestHandoffPending(false);
    }
  }

  async function handleContinue() {
    if (isElectronAuth) {
      await transferElectronUser(authSearch);
      return;
    }

    continueWebAuth(authSearch);
  }

  return (
    <main className="mp-block mp-no-track bg-background text-foreground flex min-h-svh items-center justify-center px-4 py-8 sm:px-6 md:py-10">
      <section className="w-full max-w-sm">
        {session && !isPending && isGuestGenerationSignup ? (
          <AuthCard
            title="Finish creating your account"
            description={`Signed in as ${session.user.email}. Continue to finish creating your account.`}
          >
            <div className="flex flex-col gap-3">
              {serverError ? (
                <FieldError className="border-destructive/20 bg-destructive/10 rounded-md border px-3 py-2">
                  {serverError}
                </FieldError>
              ) : null}
              <Button
                className="w-full"
                disabled={isGuestHandoffPending}
                onClick={() => void completeGuestHandoff()}
              >
                {isGuestHandoffPending ? (
                  <Loader2 className="animate-spin" />
                ) : null}
                Continue
              </Button>
            </div>
          </AuthCard>
        ) : session && !isPending ? (
          <AuthCard
            title={isElectronAuth ? "Opening Remora" : "Already signed in"}
            description={
              isElectronAuth
                ? "You're signed in. Return to the desktop app to continue."
                : `Signed in as ${session.user.email}.`
            }
          >
            <Button className="w-full" onClick={() => void handleContinue()}>
              {isElectronAuth ? "Open Remora" : "Continue"}
            </Button>
          </AuthCard>
        ) : (
          <AuthCard
            title="Get started"
            description="Create an account to use Remora."
            footer={
              <>
                Have an account?{" "}
                <Link
                  to="/sign-in"
                  search={authSearch}
                  className="text-card-foreground font-medium underline-offset-4 hover:underline"
                >
                  Sign in
                </Link>
              </>
            }
          >
            <form
              autoComplete="on"
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void form.handleSubmit();
              }}
            >
              <ClientOnly fallback={<SignUpFieldsFallback />}>
                <FieldGroup>
                  <form.Field name="name">
                    {(field) => (
                      <AuthTextField
                        id={field.name}
                        label="Name"
                        value={field.state.value}
                        errors={field.state.meta.errors}
                        autoComplete="name"
                        onBlur={field.handleBlur}
                        onChange={field.handleChange}
                      />
                    )}
                  </form.Field>

                  <form.Field name="email">
                    {(field) => (
                      <AuthTextField
                        id={field.name}
                        label="Email"
                        type="email"
                        value={field.state.value}
                        errors={field.state.meta.errors}
                        autoComplete="email"
                        inputMode="email"
                        onBlur={field.handleBlur}
                        onChange={field.handleChange}
                      />
                    )}
                  </form.Field>

                  <form.Field name="password">
                    {(field) => (
                      <AuthTextField
                        id={field.name}
                        label="Password"
                        type="password"
                        value={field.state.value}
                        errors={field.state.meta.errors}
                        autoComplete="new-password"
                        description="Use 8 characters or more."
                        onBlur={field.handleBlur}
                        onChange={field.handleChange}
                      />
                    )}
                  </form.Field>

                  <form.Field name="confirmPassword">
                    {(field) => (
                      <AuthTextField
                        id={field.name}
                        label="Confirm password"
                        type="password"
                        value={field.state.value}
                        errors={field.state.meta.errors}
                        autoComplete="new-password"
                        onBlur={field.handleBlur}
                        onChange={field.handleChange}
                      />
                    )}
                  </form.Field>

                  {serverError ? (
                    <FieldError className="border-destructive/20 bg-destructive/10 rounded-md border px-3 py-2">
                      {serverError}
                    </FieldError>
                  ) : null}

                  <form.Subscribe
                    selector={(state) => state.isSubmitting}
                    children={(isSubmitting) => (
                      <Button
                        className="w-full"
                        type="submit"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <Loader2 className="animate-spin" />
                        ) : null}
                        Create account
                      </Button>
                    )}
                  />
                </FieldGroup>
              </ClientOnly>
            </form>
          </AuthCard>
        )}
      </section>
    </main>
  );
}

function continueToCheckEmail() {
  window.location.assign("/check-email?send=true");
}

function formatHandoffError(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Unable to continue your guest generation. Try again.";
}

function SignUpFieldsFallback() {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="name">Name</FieldLabel>
        <StaticInputFallback id="name" name="name" autoComplete="name" />
      </Field>
      <Field>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <StaticInputFallback
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="password">Password</FieldLabel>
        <StaticInputFallback
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
        />
        <FieldDescription>Use 8 characters or more.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
        <StaticInputFallback
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
        />
      </Field>
      <StaticSubmitFallback>Create account</StaticSubmitFallback>
    </FieldGroup>
  );
}

function StaticInputFallback({
  autoComplete,
  id,
  inputMode,
  name,
  type = "text",
}: {
  autoComplete: string;
  id: string;
  inputMode?: "email";
  name: string;
  type?: "email" | "password" | "text";
}) {
  return (
    <input
      autoCapitalize={type === "email" ? "none" : undefined}
      autoComplete={autoComplete}
      className="border-input h-8 w-full rounded-md border bg-transparent"
      id={id}
      inputMode={inputMode}
      name={name}
      spellCheck={type === "email" ? false : undefined}
      type={type}
    />
  );
}

function StaticSubmitFallback({ children }: { children: string }) {
  return (
    <div
      aria-hidden="true"
      className="bg-primary text-primary-foreground flex h-8 w-full items-center justify-center rounded-lg px-2.5 text-sm"
    >
      {children}
    </div>
  );
}

function AuthTextField({
  id,
  label,
  type = "text",
  value,
  errors,
  description,
  autoComplete,
  inputMode,
  onBlur,
  onChange,
}: {
  id: string;
  label: string;
  type?: "email" | "password" | "text";
  value: string;
  errors: readonly unknown[];
  description?: string;
  autoComplete: string;
  inputMode?: "email";
  onBlur: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <FormTextField
      id={id}
      label={label}
      type={type}
      value={value}
      errors={errors}
      description={description}
      autoComplete={autoComplete}
      inputMode={inputMode}
      onBlur={onBlur}
      onChange={onChange}
    />
  );
}
