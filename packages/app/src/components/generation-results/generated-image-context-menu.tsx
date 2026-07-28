import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@remora/ui";
import type { ReactElement } from "react";

import { getAttachmentMediaRoleLabel } from "../../lib/generation/attachment-media.ts";
import type {
  GeneratedImageContextMenuActions,
  GeneratedImageDescriptor,
} from "../../lib/generation/generated-image.ts";

export function GeneratedImageContextMenu({
  actions,
  children,
  image,
}: {
  actions?: GeneratedImageContextMenuActions;
  children: ReactElement;
  image: GeneratedImageDescriptor | null | undefined;
}) {
  if (!actions || !image) {
    return children;
  }

  const roleChoices = actions.getRoleChoices(image);

  return (
    <ContextMenu>
      <ContextMenuTrigger render={children} />
      <ContextMenuContent>
        {roleChoices.map((choice) => (
          <ContextMenuItem
            key={choice.role}
            disabled={choice.disabled}
            onClick={() => actions.onAdd(image, choice.role)}
          >
            Use as {getAttachmentMediaRoleLabel(choice.role).toLowerCase()}
          </ContextMenuItem>
        ))}
        {roleChoices.length > 0 ? <ContextMenuSeparator /> : null}
        <ContextMenuItem onClick={() => actions.onDownload(image)}>
          Download image
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
