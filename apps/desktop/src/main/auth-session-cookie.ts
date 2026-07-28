export type AuthCookieJar = Record<string, string>;

export function applyAuthSetCookieHeaders(
  cookieJar: AuthCookieJar,
  setCookieHeader: readonly string[] | string | null | undefined,
) {
  const headers = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];
  const nextCookieJar = { ...cookieJar };

  for (const header of headers) {
    for (const cookie of parseBetterAuthCookies(header)) {
      if (cookie.deleted) {
        delete nextCookieJar[cookie.name];
      } else {
        nextCookieJar[cookie.name] = cookie.value;
      }
    }
  }

  return nextCookieJar;
}

export function createAuthCookieJar(cookieHeader: string | null | undefined) {
  const cookieJar: AuthCookieJar = {};

  for (const cookie of cookieHeader?.split(";") ?? []) {
    const separatorIndex = cookie.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const name = cookie.slice(0, separatorIndex).trim();
    const value = cookie.slice(separatorIndex + 1).trim();

    if (isBetterAuthCookieName(name) && value) {
      cookieJar[name] = value;
    }
  }

  return cookieJar;
}

export function getAuthCookieHeader(cookieJar: AuthCookieJar) {
  const entries = Object.entries(cookieJar);

  return entries.length === 0
    ? null
    : entries.map(([name, value]) => `${name}=${value}`).join("; ");
}

export function normalizeStoredAuthCookieJar(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  if ("cookie" in value && typeof value.cookie === "string") {
    return createAuthCookieJar(value.cookie);
  }

  if (
    !("cookies" in value) ||
    !value.cookies ||
    typeof value.cookies !== "object"
  ) {
    return null;
  }

  const cookieJar: AuthCookieJar = {};

  for (const [name, cookieValue] of Object.entries(value.cookies)) {
    if (isBetterAuthCookieName(name) && typeof cookieValue === "string") {
      cookieJar[name] = cookieValue;
    }
  }

  return cookieJar;
}

function parseBetterAuthCookies(header: string) {
  const cookiePattern =
    /(?:^|,\s*)((?:__Secure-)?better-auth\.[^=;,\s]+)=([^;,]*)/g;
  const matches = Array.from(header.matchAll(cookiePattern));

  return matches.flatMap((match, index) => {
    const name = match[1];
    const value = match[2];

    if (!name || value === undefined || !isBetterAuthCookieName(name)) {
      return [];
    }

    const attributesStart = (match.index ?? 0) + match[0].length;
    const attributesEnd = matches[index + 1]?.index ?? header.length;
    const attributes = header.slice(attributesStart, attributesEnd);
    const deleted =
      value.length === 0 ||
      /;\s*max-age=0(?:;|,|$)/i.test(attributes) ||
      isExpired(attributes);

    return [{ deleted, name, value }];
  });
}

function isBetterAuthCookieName(name: string) {
  return (
    name.startsWith("better-auth.") || name.startsWith("__Secure-better-auth.")
  );
}

function isExpired(attributes: string) {
  const expires = attributes.match(/;\s*expires=([^;]+)(?:;|$)/i)?.[1];

  if (!expires) {
    return false;
  }

  const expiresAt = Date.parse(expires);

  return !Number.isNaN(expiresAt) && expiresAt <= Date.now();
}
