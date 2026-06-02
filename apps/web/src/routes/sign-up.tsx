import { authClient } from "@/lib/auth-client";
import {
  getElectronFetchOptions,
  hasElectronAuthSearch,
  parseElectronAuthSearch,
  restartElectronRedirect,
  transferElectronUser,
  useElectronRedirect,
} from "@/lib/electron-auth";
import { AuthCard } from "@remora/ui/auth";
import { Button } from "@remora/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@remora/ui/field";
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
  validateSearch: parseElectronAuthSearch,
  component: SignUp,
});

function SignUp() {
  const navigate = useNavigate();
  const electronAuthSearch = Route.useSearch();
  const { data: session, isPending } = authClient.useSession();
  const [serverError, setServerError] = useState<string | null>(null);
  const isElectronAuth = hasElectronAuthSearch(electronAuthSearch);

  useElectronRedirect();

  useEffect(() => {
    if (!session || isPending) {
      return;
    }

    void transferElectronUser(electronAuthSearch);
  }, [electronAuthSearch, isPending, session]);

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

      const result = await authClient.signUp.email({
        name: value.name.trim(),
        email: value.email.trim(),
        password: value.password,
        fetchOptions: getElectronFetchOptions(electronAuthSearch),
      });

      if (result.error) {
        setServerError(result.error.message ?? "Unable to create account.");
        return;
      }

      if (!isElectronAuth) {
        await navigate({ to: "/" });
        return;
      }

      restartElectronRedirect();
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
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-8 text-foreground sm:px-6 md:py-10">
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
            title="Get started"
            description="Create an account to use Remora."
            footer={
              <>
                Have an account?{" "}
                <Link
                  to="/sign-in"
                  search={electronAuthSearch}
                  className="font-medium text-card-foreground underline-offset-4 hover:underline"
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
  const fieldErrors = getFieldErrors(errors);
  const isInvalid = fieldErrors.length > 0;
  const descriptionId =
    description && !isInvalid ? `${id}-description` : undefined;
  const errorId = isInvalid ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ");

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        name={id}
        type={type}
        value={value}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
        autoCapitalize={type === "email" ? "none" : undefined}
        autoComplete={autoComplete}
        inputMode={inputMode}
        spellCheck={type === "email" ? false : undefined}
        aria-invalid={isInvalid}
        aria-describedby={describedBy || undefined}
      />
      {description && !isInvalid ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
      <FieldError id={errorId} errors={fieldErrors} />
    </Field>
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
