import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";

import { cn } from "../utils.ts";

type SeparatorProps = Omit<SeparatorPrimitive.Props, "className"> & {
  className?: string;
};

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorProps) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "bg-border shrink-0 data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
