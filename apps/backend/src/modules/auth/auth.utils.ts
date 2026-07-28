export async function readImpersonationTransition(response: Response) {
  try {
    const body = (await response.json()) as {
      session?: { id?: unknown };
      user?: { id?: unknown };
    };

    if (
      typeof body.session?.id === "string" &&
      typeof body.user?.id === "string"
    ) {
      return {
        effectiveUserId: body.user.id,
        sessionId: body.session.id,
      };
    }
  } catch {
    // Observability must never interfere with a successful auth response.
  }

  return null;
}

export function readImpersonatedUserId(body: unknown) {
  if (
    body &&
    typeof body === "object" &&
    "userId" in body &&
    typeof body.userId === "string"
  ) {
    return body.userId;
  }

  return null;
}
