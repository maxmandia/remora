"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import { cn } from "../utils.ts";
import { Button } from "./button.tsx";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "./input-group.tsx";

type ComboboxSurface = "popup" | "strong" | "card";

type ComboboxSurfaceContextValue = {
  surface: ComboboxSurface;
  setSurface: Dispatch<SetStateAction<ComboboxSurface>>;
};

const ComboboxSurfaceContext =
  createContext<ComboboxSurfaceContextValue | null>(null);

function getComboboxSurface(element: HTMLElement | null): ComboboxSurface {
  const surface = element?.closest<HTMLElement>(
    '[data-surface="card"], [data-surface="strong"], [data-surface="popup"]',
  )?.dataset.surface;

  if (surface === "card" || surface === "strong") {
    return surface;
  }

  return "popup";
}

function Combobox<Value, Multiple extends boolean | undefined = false>({
  children,
  ...props
}: ComboboxPrimitive.Root.Props<Value, Multiple>) {
  const [surface, setSurface] = useState<ComboboxSurface>("popup");
  const surfaceContextValue = useMemo(
    () => ({ surface, setSurface }),
    [surface],
  );

  return (
    <ComboboxSurfaceContext.Provider value={surfaceContextValue}>
      <ComboboxPrimitive.Root {...props}>{children}</ComboboxPrimitive.Root>
    </ComboboxSurfaceContext.Provider>
  );
}

type StatefulClassName<State> =
  | string
  | ((state: State) => string | undefined)
  | undefined;

function mergeStatefulClassName<State>(
  baseClassName: string,
  className: StatefulClassName<State>,
) {
  return typeof className === "function"
    ? (state: State) => cn(baseClassName, className(state))
    : cn(baseClassName, className);
}

function ComboboxValue({ ...props }: ComboboxPrimitive.Value.Props) {
  return <ComboboxPrimitive.Value data-slot="combobox-value" {...props} />;
}

function ComboboxTrigger({
  className,
  children,
  showIndicator = true,
  ...props
}: ComboboxPrimitive.Trigger.Props & {
  showIndicator?: boolean;
}) {
  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      className={mergeStatefulClassName(
        "[&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      {showIndicator ? (
        <ChevronDownIcon className="text-muted-foreground pointer-events-none size-4" />
      ) : null}
    </ComboboxPrimitive.Trigger>
  );
}

function ComboboxClear({ className, ...props }: ComboboxPrimitive.Clear.Props) {
  return (
    <ComboboxPrimitive.Clear
      data-slot="combobox-clear"
      render={
        <InputGroupButton
          variant="ghost"
          size="icon-xs"
          className="border-none"
        />
      }
      className={className}
      {...props}
    >
      <XIcon className="pointer-events-none" />
    </ComboboxPrimitive.Clear>
  );
}

function ComboboxInput({
  className,
  children,
  disabled = false,
  icon,
  iconAriaLabel = "Open combobox",
  showTrigger = true,
  showClear = false,
  ...props
}: Omit<ComboboxPrimitive.Input.Props, "className"> & {
  className?: string;
  icon?: ReactNode;
  iconAriaLabel?: string;
  showTrigger?: boolean;
  showClear?: boolean;
}) {
  const inputGroupRef = useRef<HTMLDivElement | null>(null);
  const surfaceContext = useContext(ComboboxSurfaceContext);

  useLayoutEffect(() => {
    const nextSurface = getComboboxSurface(inputGroupRef.current);

    surfaceContext?.setSurface((currentSurface) =>
      currentSurface === nextSurface ? currentSurface : nextSurface,
    );
  });

  return (
    <InputGroup
      ref={inputGroupRef}
      className={cn(
        "w-fit border-none has-[[data-slot=input-group-control]:focus-visible]:border-none has-[[data-slot=input-group-control]:focus-visible]:ring-0",
        className,
      )}
    >
      {icon ? (
        <InputGroupAddon align="inline-start" className="py-0">
          <InputGroupButton
            aria-label={iconAriaLabel}
            size="icon-xs"
            variant="ghost"
            render={<ComboboxTrigger showIndicator={false} />}
            data-slot="input-group-button"
            className="cursor-default border-none hover:bg-transparent hover:text-inherit focus-visible:bg-transparent focus-visible:text-inherit aria-expanded:bg-transparent aria-expanded:text-inherit data-pressed:bg-transparent data-[popup-open]:bg-transparent data-[popup-open]:text-inherit"
            disabled={disabled}
          >
            {icon}
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
      <ComboboxPrimitive.Input
        render={
          <InputGroupInput
            className="text-secondary-foreground placeholder:text-secondary-foreground caret-secondary-foreground field-sizing-content w-auto min-w-0 flex-none px-0"
            disabled={disabled}
          />
        }
        {...props}
      />
      <InputGroupAddon align="inline-end" className="pr-0 pl-1">
        {showTrigger ? (
          <InputGroupButton
            size="icon-xs"
            variant="ghost"
            render={<ComboboxTrigger />}
            data-slot="input-group-button"
            className="border-none group-has-data-[slot=combobox-clear]/input-group:hidden data-pressed:bg-transparent"
            disabled={disabled}
          />
        ) : null}
        {showClear ? <ComboboxClear disabled={disabled} /> : null}
      </InputGroupAddon>
      {children}
    </InputGroup>
  );
}

function ComboboxContent({
  className,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  alignOffset = 0,
  anchor,
  ...props
}: ComboboxPrimitive.Popup.Props &
  Pick<
    ComboboxPrimitive.Positioner.Props,
    "side" | "align" | "sideOffset" | "alignOffset" | "anchor"
  >) {
  const surface = useContext(ComboboxSurfaceContext)?.surface ?? "popup";

  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="isolate z-50"
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          data-chips={Boolean(anchor)}
          data-surface={surface}
          className={mergeStatefulClassName(
            "group/combobox-content text-secondary-foreground ring-foreground/10 data-[surface=card]:bg-card data-[surface=popup]:bg-popover data-[surface=strong]:bg-popover data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 *:data-[slot=input-group]:border-input/30 *:data-[slot=input-group]:bg-input/30 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 relative max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) min-w-[calc(var(--anchor-width)+--spacing(7))] origin-(--transform-origin) overflow-hidden rounded-lg shadow-md ring-1 duration-100 data-[chips=true]:min-w-(--anchor-width) *:data-[slot=input-group]:m-1 *:data-[slot=input-group]:mb-0 *:data-[slot=input-group]:h-8 *:data-[slot=input-group]:shadow-none",
            className,
          )}
          {...props}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={mergeStatefulClassName(
        "no-scrollbar max-h-[min(calc(--spacing(72)---spacing(9)),calc(var(--available-height)---spacing(9)))] scroll-py-1 overflow-y-auto overscroll-contain p-1 data-empty:p-0",
        className,
      )}
      {...props}
    />
  );
}

function ComboboxItem({
  className,
  children,
  icon,
  ...props
}: ComboboxPrimitive.Item.Props & {
  icon?: ReactNode;
}) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={mergeStatefulClassName(
        "data-highlighted:text-secondary-foreground not-data-[variant=destructive]:data-highlighted:**:text-secondary-foreground relative flex w-full min-w-0 flex-1 cursor-default items-center gap-2 truncate rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-[var(--surface-interactive-hover)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span
          aria-hidden="true"
          data-slot="combobox-item-icon"
          className="text-muted-foreground flex size-4 shrink-0 items-center justify-center"
        >
          {icon}
        </span>
      ) : null}
      {children}
      <ComboboxPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
        }
      >
        <CheckIcon className="pointer-events-none" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  );
}

function ComboboxGroup({ className, ...props }: ComboboxPrimitive.Group.Props) {
  return (
    <ComboboxPrimitive.Group
      data-slot="combobox-group"
      className={className}
      {...props}
    />
  );
}

function ComboboxLabel({
  className,
  ...props
}: ComboboxPrimitive.GroupLabel.Props) {
  return (
    <ComboboxPrimitive.GroupLabel
      data-slot="combobox-label"
      className={mergeStatefulClassName(
        "text-secondary-foreground px-2 py-1.5 text-xs",
        className,
      )}
      {...props}
    />
  );
}

function ComboboxCollection({ ...props }: ComboboxPrimitive.Collection.Props) {
  return (
    <ComboboxPrimitive.Collection data-slot="combobox-collection" {...props} />
  );
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={mergeStatefulClassName(
        "text-secondary-foreground hidden w-full justify-center py-2 text-center text-sm group-data-empty/combobox-content:flex",
        className,
      )}
      {...props}
    />
  );
}

function ComboboxSeparator({
  className,
  ...props
}: ComboboxPrimitive.Separator.Props) {
  return (
    <ComboboxPrimitive.Separator
      data-slot="combobox-separator"
      className={mergeStatefulClassName("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

function ComboboxChips({
  className,
  ...props
}: ComponentPropsWithRef<typeof ComboboxPrimitive.Chips> &
  ComboboxPrimitive.Chips.Props) {
  return (
    <ComboboxPrimitive.Chips
      data-slot="combobox-chips"
      className={mergeStatefulClassName(
        "border-input focus-within:border-ring focus-within:ring-ring/50 has-aria-invalid:border-destructive has-aria-invalid:ring-destructive/20 dark:bg-input/30 dark:has-aria-invalid:border-destructive/50 dark:has-aria-invalid:ring-destructive/40 flex min-h-8 flex-wrap items-center gap-1 rounded-lg border bg-transparent bg-clip-padding px-2.5 py-1 text-sm transition-colors focus-within:ring-3 has-aria-invalid:ring-3 has-data-[slot=combobox-chip]:px-1",
        className,
      )}
      {...props}
    />
  );
}

function ComboboxChip({
  className,
  children,
  showRemove = true,
  ...props
}: ComboboxPrimitive.Chip.Props & {
  showRemove?: boolean;
}) {
  return (
    <ComboboxPrimitive.Chip
      data-slot="combobox-chip"
      className={mergeStatefulClassName(
        "bg-muted text-secondary-foreground flex h-[calc(--spacing(5.25))] w-fit items-center justify-center gap-1 rounded-sm px-1.5 text-xs font-medium whitespace-nowrap has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-50 has-data-[slot=combobox-chip-remove]:pr-0",
        className,
      )}
      {...props}
    >
      {children}
      {showRemove ? (
        <ComboboxPrimitive.ChipRemove
          render={<Button variant="ghost" size="icon-xs" />}
          className="-ml-1 opacity-50 hover:opacity-100"
          data-slot="combobox-chip-remove"
        >
          <XIcon className="pointer-events-none" />
        </ComboboxPrimitive.ChipRemove>
      ) : null}
    </ComboboxPrimitive.Chip>
  );
}

function ComboboxChipsInput({
  className,
  ...props
}: ComboboxPrimitive.Input.Props) {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-chip-input"
      className={mergeStatefulClassName(
        "min-w-16 flex-1 outline-none",
        className,
      )}
      {...props}
    />
  );
}

function useComboboxAnchor() {
  return useRef<HTMLDivElement | null>(null);
}

export {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
};
