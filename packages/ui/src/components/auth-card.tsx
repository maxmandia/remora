import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "../utils.ts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../primitives/card.tsx";

function AuthCard({
  title,
  description,
  children,
  footer,
  className,
  ...props
}: ComponentPropsWithoutRef<typeof Card> & {
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card className={cn("bg-card shadow-sm", className)} {...props}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer ? (
        <div className="text-muted-foreground px-4 py-3 text-center text-sm">
          {footer}
        </div>
      ) : null}
    </Card>
  );
}

export { AuthCard };
