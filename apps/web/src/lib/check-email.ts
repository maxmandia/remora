export type CheckEmailSearch = {
  error?: "expired" | "invalid";
  send?: true;
  verified?: true;
};

export function parseCheckEmailSearch(
  search: Record<string, unknown>,
): CheckEmailSearch {
  const error =
    search.error === "TOKEN_EXPIRED"
      ? "expired"
      : search.error === "INVALID_TOKEN" ||
          search.error === "USER_NOT_FOUND" ||
          search.error === "INVALID_USER"
        ? "invalid"
        : null;
  const send = search.send === true || search.send === "true";
  const verified = search.verified === true || search.verified === "true";

  return {
    ...(error ? { error } : {}),
    ...(send ? { send: true as const } : {}),
    ...(verified ? { verified: true as const } : {}),
  };
}
