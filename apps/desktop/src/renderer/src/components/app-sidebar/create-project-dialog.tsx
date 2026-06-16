import { createProjectInputSchema } from "@remora/domain/project/validator";
import { FormTextField, useForm } from "@remora/form";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FieldError,
  FieldGroup,
} from "@remora/ui";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import { useCreateProjectMutation } from "../../modules/project/use-create-project-mutation.ts";

function canCreateProject(name: string) {
  return createProjectInputSchema.safeParse({ name }).success;
}

export function CreateProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createProjectMutation = useCreateProjectMutation({
    onError: ({ error, input }) => {
      form.setFieldValue("name", input.name);
      setSubmitError(error.message);
      onOpenChange(true);
    },
  });
  const form = useForm({
    defaultValues: {
      name: "",
    },
    validators: {
      onChange: createProjectInputSchema,
      onSubmit: createProjectInputSchema,
    },
    onSubmit: async ({ value }) => {
      const input = createProjectInputSchema.parse(value);

      setSubmitError(null);
      createProjectMutation.mutate(input);
      closeDialogAfterSubmit();
    },
  });

  function closeDialogAfterSubmit() {
    form.reset();
    setSubmitError(null);
    onOpenChange(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      form.reset();
      createProjectMutation.reset();
      setSubmitError(null);
    }

    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-label="Create project">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            Projects are useful for organizing related threads.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Field name="name">
              {(field) => (
                <FormTextField
                  id={field.name}
                  label="Project name"
                  value={field.state.value}
                  errors={field.state.meta.errors}
                  autoComplete="off"
                  onBlur={field.handleBlur}
                  onChange={(value) => {
                    setSubmitError(null);
                    createProjectMutation.reset();
                    field.handleChange(value);
                  }}
                />
              )}
            </form.Field>
            {submitError ? (
              <FieldError className="border-destructive/20 bg-destructive/10 rounded-md border px-3 py-2">
                {submitError}
              </FieldError>
            ) : null}
          </FieldGroup>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isNameValid: canCreateProject(state.values.name),
                isSubmitting: state.isSubmitting,
              })}
              children={({ canSubmit, isNameValid, isSubmitting }) => (
                <Button
                  type="submit"
                  disabled={
                    !isNameValid ||
                    !canSubmit ||
                    isSubmitting ||
                    createProjectMutation.isPending
                  }
                >
                  {isSubmitting || createProjectMutation.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : null}
                  Create project
                </Button>
              )}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
