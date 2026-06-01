import { authClient } from "@/lib/auth-client";
import {
  getElectronFetchOptions,
  hasElectronAuthSearch,
  parseElectronAuthSearch,
  transferElectronUser,
  useElectronRedirect,
} from "@/lib/electron-auth";
import { AuthCard } from "@remora/ui/auth";
import { Button } from "@remora/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@remora/ui/field";
import { Input } from "@remora/ui/input";
import { useForm } from "@tanstack/react-form";
import {
  ClientOnly,
  createFileRoute,
  Link,
  useNavigate,
} from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";

const signInSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const Route = createFileRoute("/sign-in")({
  validateSearch: parseElectronAuthSearch,
  component: SignIn,
});

function SignIn() {
  const navigate = useNavigate();
  const electronAuthSearch = Route.useSearch();
  const { data: session, isPending } = authClient.useSession();
  const [serverError, setServerError] = useState<string | null>(null);

  useElectronRedirect();

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

      if (!hasElectronAuthSearch(electronAuthSearch)) {
        await navigate({ to: "/" });
      }
    },
  });

  async function handleContinue() {
    if (hasElectronAuthSearch(electronAuthSearch)) {
      await transferElectronUser(electronAuthSearch);
      return;
    }

    await navigate({ to: "/" });
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-8 text-foreground sm:px-6 md:py-10">
      <section className="w-full max-w-sm">
        {session && !isPending ? (
          <AuthCard
            title="Already signed in"
            description={`Signed in as ${session.user.email}.`}
          >
            <Button className="w-full" onClick={() => void handleContinue()}>
              Continue
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
                  className="font-medium text-card-foreground underline-offset-4 hover:underline"
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
                    {(field) => {
                      const errors = getFieldErrors(field.state.meta.errors);
                      const isInvalid = errors.length > 0;

                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            type="email"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            autoCapitalize="none"
                            autoComplete="username"
                            inputMode="email"
                            spellCheck={false}
                            aria-invalid={isInvalid}
                            aria-describedby={
                              isInvalid ? `${field.name}-error` : undefined
                            }
                          />
                          <FieldError
                            id={`${field.name}-error`}
                            errors={errors}
                          />
                        </Field>
                      );
                    }}
                  </form.Field>

                  <form.Field name="password">
                    {(field) => {
                      const errors = getFieldErrors(field.state.meta.errors);
                      const isInvalid = errors.length > 0;

                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            type="password"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            autoComplete="current-password"
                            aria-invalid={isInvalid}
                            aria-describedby={
                              isInvalid ? `${field.name}-error` : undefined
                            }
                          />
                          <FieldError
                            id={`${field.name}-error`}
                            errors={errors}
                          />
                        </Field>
                      );
                    }}
                  </form.Field>

                  {serverError ? (
                    <FieldError className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2">
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
      className="h-8 w-full rounded-md border border-input bg-transparent"
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
      className="flex h-8 w-full items-center justify-center rounded-lg bg-primary px-2.5 text-sm text-primary-foreground"
    >
      {children}
    </div>
  );
}

function getFieldErrors(errors: readonly unknown[]) {
  return errors
    .map((error) => {
      if (typeof error === "string") {
        return { message: error };
      }

      if (
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof error.message === "string"
      ) {
        return { message: error.message };
      }

      return undefined;
    })
    .filter((error): error is { message: string } => Boolean(error));
}
