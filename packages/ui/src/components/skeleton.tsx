import { cn } from "../utils.ts";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-skeleton rounded-md", className)}
      {...props}
    />
  );
}

export { Skeleton };
