import { Button } from "@remora/ui";
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

import { TooltipWithShortcut } from "../tooltip-with-shortcut.tsx";

type GenerationSubmissionSidePanelProps = {
  activeSubmissionId?: string;
  ariaLabel: string;
  children: ReactNode;
  closeAriaLabel: string;
  contentAriaLabel?: string;
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
  contentElement: Content = "div",
  contentSlot,
  id,
  isOpen,
  panelSlot,
  title,
  onClose,
}: GenerationSubmissionSidePanelProps) {
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
        <TooltipWithShortcut
          commandId="generation.closeStackPanel"
          side="left"
          sideOffset={8}
          text="Close panel"
        >
          <Button
            aria-label={closeAriaLabel}
            size="icon"
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            <XIcon className="text-secondary-foreground" />
          </Button>
        </TooltipWithShortcut>
      </div>
      <Content
        {...(contentAriaLabel ? { "aria-label": contentAriaLabel } : {})}
        className="-mr-2 grid min-h-0 flex-1 auto-rows-max content-start gap-2 overflow-x-hidden overflow-y-auto pr-2"
        data-slot={contentSlot}
      >
        {children}
      </Content>
    </aside>
  );
}
