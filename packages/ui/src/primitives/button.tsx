import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "../utils.ts";

const baseButtonClass =
  "group/button inline-flex cursor-pointer shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const buttonVariantClasses = {
  default: "bg-primary text-primary-foreground hover:bg-primary/80",
  outline:
    "border-input bg-transparent text-foreground hover:bg-[var(--surface-interactive-hover)] hover:text-foreground aria-expanded:bg-[var(--surface-interactive-active)] aria-expanded:text-foreground",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
  ghost:
    "hover:bg-[var(--surface-interactive-hover)] hover:text-foreground focus-visible:bg-[var(--surface-interactive-hover)] aria-expanded:bg-[var(--surface-interactive-active)] aria-expanded:text-foreground data-[popup-open]:bg-[var(--surface-interactive-active)] dark:hover:bg-[var(--surface-interactive-hover)] dark:focus-visible:bg-[var(--surface-interactive-hover)] dark:aria-expanded:bg-[var(--surface-interactive-active)] dark:data-[popup-open]:bg-[var(--surface-interactive-active)]",
  destructive:
    "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
  link: "text-primary underline-offset-4 hover:underline",
  shortcut:
    "bg-primary text-primary-foreground hover:bg-primary/80 has-data-[slot=button-shortcut]:gap-2",
} as const;

const buttonSizeClasses = {
  default:
    "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 has-data-[slot=button-shortcut]:pr-1.5",
  xs: 'h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 has-data-[slot=button-shortcut]:pr-1 [&_svg:not([class*="size-"])]:size-3',
  sm: 'h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 has-data-[slot=button-shortcut]:pr-1 [&_svg:not([class*="size-"])]:size-3.5',
  lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 has-data-[slot=button-shortcut]:pr-1.5",
  icon: "size-8",
  "icon-xs":
    'size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*="size-"])]:size-3',
  "icon-sm":
    "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
  "icon-lg": "size-9",
} as const;

type ButtonVariant = keyof typeof buttonVariantClasses;
type ButtonSize = keyof typeof buttonSizeClasses;

type ButtonVariantProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

type ButtonShortcutPart = string | number;
type ButtonShortcutValue = ButtonShortcutPart | readonly ButtonShortcutPart[];

type ButtonProps = ButtonPrimitive.Props &
  ButtonVariantProps & {
    shortcut?: ButtonShortcutValue;
  };

function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: ButtonVariantProps & { className?: string } = {}) {
  return cn(
    baseButtonClass,
    buttonVariantClasses[variant],
    buttonSizeClasses[size],
    className,
  );
}

function Button({
  children,
  className,
  shortcut,
  variant = "default",
  size = "default",
  ...props
}: ButtonProps) {
  const resolvedClassName: ButtonPrimitive.Props["className"] =
    typeof className === "function"
      ? (state) =>
          buttonVariants({ variant, size, className: className(state) })
      : buttonVariants({ variant, size, className });
  const shortcutParts = normalizeShortcutParts(shortcut);

  return (
    <ButtonPrimitive
      data-slot="button"
      className={resolvedClassName}
      {...props}
    >
      {children}
      {shortcutParts.map((part) => (
        <ButtonShortcut aria-hidden="true" key={part}>
          {part}
        </ButtonShortcut>
      ))}
    </ButtonPrimitive>
  );
}

function ButtonShortcut({
  className,
  ...props
}: ComponentPropsWithoutRef<"kbd">) {
  return (
    <kbd
      data-slot="button-shortcut"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-current/15 bg-current/10 px-1.5 text-[0.68rem] leading-none font-normal text-current opacity-80 shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]",
        className,
      )}
      {...props}
    />
  );
}

function normalizeShortcutParts(shortcut: ButtonShortcutValue | undefined) {
  if (shortcut === undefined) {
    return [];
  }

  return Array.isArray(shortcut) ? shortcut : [shortcut];
}

export { Button, buttonVariants };
