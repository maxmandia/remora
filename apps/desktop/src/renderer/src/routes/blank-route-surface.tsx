import type { AuthStatus, AuthUser } from "@remora/app/auth";

export function BlankRouteSurface({
  status,
  user,
}: {
  status: AuthStatus;
  user: AuthUser | null;
}) {
  return (
    <main
      className="bg-background text-foreground h-full min-h-full"
      data-auth-status={status}
      data-user-id={user?.id}
    />
  );
}
