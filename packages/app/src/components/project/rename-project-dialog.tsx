import type { ProjectSummary } from "@remora/domain/project/dto";
import {
  createProjectInputSchema,
  renameProjectInputSchema,
} from "@remora/domain/project/validator";
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

import { useRenameProjectMutation } from "../../hooks/use-rename-project-mutation.ts";

function canRenameProject(project: ProjectSummary, name: string) {
  const parsedInput = renameProjectInputSchema.safeParse({
    projectId: project.id,
    name,
  });

  return parsedInput.success && parsedInput.data.name !== project.name;
}

export type RenameProjectDialogProps = {
  open: boolean;
  project: ProjectSummary;
  onOpenChange: (open: boolean) => void;
};

export function RenameProjectDialog({
  open,
  project,
  onOpenChange,
}: RenameProjectDialogProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const renameProjectMutation = useRenameProjectMutation({
    onError: ({ error, input }) => {
      form.setFieldValue("name", input.name);
      setSubmitError(error.message);
    },
    onSuccess: () => {
      form.reset({ name: project.name });
      setSubmitError(null);
      onOpenChange(false);
    },
  });
  const form = useForm({
    defaultValues: {
      name: project.name,
    },
    validators: {
      onChange: createProjectInputSchema,
      onSubmit: createProjectInputSchema,
    },
    onSubmit: async ({ value }) => {
      const input = renameProjectInputSchema.parse({
        projectId: project.id,
        name: value.name,
      });

      setSubmitError(null);
      renameProjectMutation.mutate(input);
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      form.reset({ name: project.name });
      renameProjectMutation.reset();
      setSubmitError(null);
    }

    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-label="Rename project">
        <DialogHeader>
          <DialogTitle>Rename project</DialogTitle>
          <DialogDescription>
            Enter a new name for this project.
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
                    renameProjectMutation.reset();
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
                isNameValid: canRenameProject(project, state.values.name),
                isSubmitting: state.isSubmitting,
              })}
              children={({ canSubmit, isNameValid, isSubmitting }) => (
                <Button
                  type="submit"
                  disabled={
                    !isNameValid ||
                    !canSubmit ||
                    isSubmitting ||
                    renameProjectMutation.isPending
                  }
                >
                  {isSubmitting || renameProjectMutation.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : null}
                  Rename
                </Button>
              )}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
