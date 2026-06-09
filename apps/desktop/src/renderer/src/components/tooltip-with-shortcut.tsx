import type { ComponentPropsWithoutRef, ReactElement } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@remora/ui";

import {
  getHotkeyDefinition,
  getHotkeyDisplayParts,
  type HotkeyCommandId,
} from "../lib/hotkey-registry.ts";

type TooltipContentPlacementProps = Pick<
  ComponentPropsWithoutRef<typeof TooltipContent>,
  "align" | "alignOffset" | "side" | "sideOffset"
>;

type TooltipWithShortcutProps = TooltipContentPlacementProps & {
  children: ReactElement;
  commandId: HotkeyCommandId;
  text: string;
};

export function TooltipWithShortcut({
  align,
  alignOffset,
  children,
  commandId,
  side,
  sideOffset,
  text,
}: TooltipWithShortcutProps) {
  const hotkey = getHotkeyDefinition(commandId);
  const shortcutParts = getHotkeyDisplayParts(hotkey.combo);

  return (
    <Tooltip>
      <TooltipTrigger aria-keyshortcuts={hotkey.combo} render={children} />
      <TooltipContent
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <span>{text}</span>
        <span aria-hidden="true" className="inline-flex items-center gap-1">
          {shortcutParts.map((part, index) => (
            <kbd
              data-slot="kbd"
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-current/15 bg-current/10 px-1.5 text-[0.68rem] leading-none font-normal text-current opacity-80 shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]"
              key={`${part}:${index}`}
            >
              {part}
            </kbd>
          ))}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
