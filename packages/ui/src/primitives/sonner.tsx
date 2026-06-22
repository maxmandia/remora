import type { CSSProperties } from "react";
import type { ToasterProps } from "sonner";
import { Toaster as Sonner, toast } from "sonner";

import { cn } from "../utils.ts";

function Toaster({
  className,
  position = "bottom-right",
  richColors = true,
  closeButton = true,
  theme = "dark",
  toastOptions,
  style,
  ...props
}: ToasterProps) {
  return (
    <Sonner
      className={cn("toaster group", className)}
      closeButton={closeButton}
      position={position}
      richColors={richColors}
      style={
        {
          "--normal-bg": "var(--surface-strong)",
          "--normal-bg-hover": "var(--surface-strong)",
          "--normal-border": "var(--border)",
          "--normal-border-hover": "var(--border)",
          "--normal-text": "var(--secondary-foreground)",
          ...style,
        } as CSSProperties
      }
      theme={theme}
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-surface-strong group-[.toaster]:text-secondary-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          title:
            "group-[.toast]:!font-normal group-[.toast]:!text-surface-strong-foreground",
          description: "group-[.toast]:text-secondary-foreground",
          closeButton:
            "group-[.toast]:!bg-background group-[.toast]:!text-secondary-foreground group-[.toast]:!border-border group-[.toast]:hover:!bg-border group-[.toast]:hover:!text-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  );
}

export { toast, Toaster };
