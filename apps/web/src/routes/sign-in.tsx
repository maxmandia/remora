import { authClient } from "@/lib/auth-client";
import {
  getElectronFetchOptions,
  hasElectronAuthSearch,
  parseElectronAuthSearch,
  restartElectronRedirect,
  transferElectronUser,
  useElectronRedirect,
} from "@/lib/electron-auth";
import {
  AuthCard,
  Button,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@remora/ui";
import { FormTextField, useForm } from "@remora/form";
import {
  ClientOnly,
  createFileRoute,
  Link,
  useNavigate,
} from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { createSeoHead } from "../lib/seo";

const signInSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const Route = createFileRoute("/sign-in")({
  validateSearch: parseElectronAuthSearch,
  component: SignIn,
  head: () =>
    createSeoHead({
      canonicalPath: "/sign-in",
      description: "Sign in to Remora.",
      index: false,
      title: "Sign in | Remora",
    }),
});

function SignIn() {
  const navigate = useNavigate();
  const electronAuthSearch = Route.useSearch();
  const { data: session, isPending } = authClient.useSession();
  const [serverError, setServerError] = useState<string | null>(null);
  const isElectronAuth = hasElectronAuthSearch(electronAuthSearch);

  useElectronRedirect(electronAuthSearch);

  useEffect(() => {
    if (!session || isPending) {
      return;
    }

    void transferElectronUser(electronAuthSearch);
  }, [electronAuthSearch, isPending, session]);

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validators: {
      onSubmit: signInSchema,
    },
    onSubmit: async ({ value }) => {
      setServerError(null);

      const result = await authClient.signIn.email({
        email: value.email.trim(),
        password: value.password,
        fetchOptions: getElectronFetchOptions(electronAuthSearch),
      });

      if (result.error) {
        setServerError(result.error.message ?? "Unable to sign in.");
        return;
      }

      if (!isElectronAuth) {
        await navigate({ to: "/" });
        return;
      }

      restartElectronRedirect(electronAuthSearch);
    },
  });

  async function handleContinue() {
    if (isElectronAuth) {
      await transferElectronUser(electronAuthSearch);
      return;
    }

    await navigate({ to: "/" });
  }

  return (
    <main className="mp-block mp-no-track bg-background text-foreground flex min-h-svh items-center justify-center px-4 py-8 sm:px-6 md:py-10">
      <section className="w-full max-w-sm">
        {session && !isPending ? (
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
            title="Welcome back"
            description="Sign in to use Remora."
            footer={
              <>
                No account?{" "}
                <Link
                  to="/sign-up"
                  search={electronAuthSearch}
                  className="text-card-foreground font-medium underline-offset-4 hover:underline"
                >
                  Sign up
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
              <ClientOnly fallback={<SignInFieldsFallback />}>
                <FieldGroup>
                  <form.Field name="email">
                    {(field) => (
                      <FormTextField
                        id={field.name}
                        label="Email"
                        type="email"
                        value={field.state.value}
                        errors={field.state.meta.errors}
                        autoComplete="username"
                        inputMode="email"
                        onBlur={field.handleBlur}
                        onChange={field.handleChange}
                      />
                    )}
                  </form.Field>

                  <form.Field name="password">
                    {(field) => (
                      <FormTextField
                        id={field.name}
                        label="Password"
                        type="password"
                        value={field.state.value}
                        errors={field.state.meta.errors}
                        autoComplete="current-password"
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
                        Sign in
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

function SignInFieldsFallback() {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <StaticInputFallback
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="password">Password</FieldLabel>
        <StaticInputFallback
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
        />
      </Field>
      <StaticSubmitFallback>Sign in</StaticSubmitFallback>
    </FieldGroup>
  );
}

function StaticInputFallback({
  autoComplete,
  id,
  inputMode,
  name,
  type,
}: {
  autoComplete: string;
  id: string;
  inputMode?: "email";
  name: string;
  type: "email" | "password";
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
