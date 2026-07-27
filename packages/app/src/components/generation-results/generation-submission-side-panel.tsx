import {
  Button,
  cn,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@remora/ui";
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
  getHotkeyDefinition,
  getHotkeyDisplayParts,
} from "../../lib/hotkey-registry.ts";

type GenerationSubmissionSidePanelProps = {
  activeSubmissionId?: string;
  ariaLabel: string;
  children: ReactNode;
  closeAriaLabel: string;
  contentAriaLabel?: string;
  contentClassName?: string;
  contentElement?: "div" | "ul";
  contentSlot: string;
  id: string;
  isOpen: boolean;
  panelSlot: string;
  title: string;
  onClose: () => void;
};

export function GenerationSubmissionSidePanel({
  activeSubmissionId,
  ariaLabel,
  children,
  closeAriaLabel,
  contentAriaLabel,
  contentClassName,
  contentElement: Content = "div",
  contentSlot,
  id,
  isOpen,
  panelSlot,
  title,
  onClose,
}: GenerationSubmissionSidePanelProps) {
  const closePanelHotkey = getHotkeyDefinition("generation.closeStackPanel");
  const closePanelShortcutParts = getHotkeyDisplayParts(closePanelHotkey.combo);

  return (
    <aside
      id={id}
      aria-hidden={!isOpen}
      aria-label={ariaLabel}
      className="bg-surface-strong border-surface-strong pointer-events-none absolute top-0 bottom-[var(--remora-generation-composer-bottom-inset)] left-[calc(100%+var(--remora-generation-stack-panel-gap))] flex w-[var(--remora-generation-stack-panel-width)] translate-x-3 scale-[0.98] flex-col overflow-hidden rounded-lg border-[.5px] p-3 opacity-0 transition-[opacity,transform] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity,transform] group-data-[state=collapsed]/sidebar-wrapper:w-[var(--remora-generation-stack-panel-expanded-width)] data-[state=open]:pointer-events-auto data-[state=open]:translate-x-0 data-[state=open]:scale-100 data-[state=open]:opacity-100 motion-reduce:transition-none"
      data-active-submission-id={activeSubmissionId}
      data-slot={panelSlot}
      data-state={isOpen ? "open" : "closed"}
    >
      <div className="flex shrink-0 justify-between">
        <div className="mt-1">
          <span className="text-foreground m-1 text-[15px] font-light">
            {title}
          </span>
        </div>
        <Tooltip>
          <TooltipTrigger
            aria-keyshortcuts={closePanelHotkey.combo}
            render={
              <Button
                aria-label={closeAriaLabel}
                size="icon"
                type="button"
                variant="ghost"
                onClick={onClose}
              />
            }
          >
            <XIcon className="text-secondary-foreground" />
          </TooltipTrigger>
          <TooltipContent side="left" sideOffset={8}>
            <span>Close panel</span>
            <span aria-hidden="true" className="inline-flex items-center gap-1">
              {closePanelShortcutParts.map((part, index) => (
                <kbd
                  className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-current/15 bg-current/10 px-1.5 text-[0.68rem] leading-none font-normal text-current opacity-80 shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]"
                  data-slot="kbd"
                  key={`${part}:${index}`}
                >
                  {part}
                </kbd>
              ))}
            </span>
          </TooltipContent>
        </Tooltip>
      </div>
      <Content
        {...(contentAriaLabel ? { "aria-label": contentAriaLabel } : {})}
        className={cn(
          "-mr-2 grid min-h-0 flex-1 auto-rows-max content-start gap-2 overflow-x-hidden overflow-y-auto pr-2",
          contentClassName,
        )}
        data-slot={contentSlot}
      >
        {children}
      </Content>
    </aside>
  );
}
