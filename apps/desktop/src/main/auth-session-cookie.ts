const sessionCookieNames = new Set([
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
]);

export function getSessionCookieFromSetCookieHeader(
  setCookieHeader: readonly string[] | string | null | undefined,
) {
  const headers = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];

  for (const header of headers) {
    const match = getSessionCookieMatch(header);

    if (match) {
      return match;
    }
  }

  return null;
}

function getSessionCookieMatch(header: string) {
  const cookiePattern =
    /(?:^|,\s*)(better-auth\.session_token|__Secure-better-auth\.session_token)=([^;,\s]+)/g;
  let match: RegExpExecArray | null = null;

  while ((match = cookiePattern.exec(header))) {
    const [, name, value] = match;

    if (!name || !value || !sessionCookieNames.has(name)) {
      continue;
    }

    return `${name}=${value}`;
  }

  return null;
}
