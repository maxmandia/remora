import { cn } from "@remora/ui";
import type { ComponentPropsWithRef } from "react";

type PromptTextareaProps = ComponentPropsWithRef<"textarea">;

function PromptTextarea({
  className,
  rows = 1,
  ...props
}: PromptTextareaProps) {
  return (
    <textarea
      className={cn(
        "text-surface-strong-foreground block field-sizing-content max-h-[25dvh] min-h-10 w-full resize-none overflow-y-auto bg-transparent py-2 leading-6 font-light focus:outline-none",
        className,
      )}
      data-slot="prompt-textarea"
      rows={rows}
      {...props}
    />
  );
}

export { PromptTextarea };
export type { PromptTextareaProps };
