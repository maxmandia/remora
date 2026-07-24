import {
  parseElectronAuthSearch,
  type ElectronAuthSearch,
} from "./electron-auth";

const defaultAppRedirect = "/app";
const redirectValidationOrigin = "https://remora.invalid";

export type AuthSearch = ElectronAuthSearch & {
  redirect?: string;
};

export function parseAuthSearch(search: Record<string, unknown>): AuthSearch {
  const electronSearch = parseElectronAuthSearch(search);
  const redirect = parseAppRedirect(search.redirect);

  return {
    ...electronSearch,
    ...(redirect ? { redirect } : {}),
  };
}

export function getAuthRedirect(search: AuthSearch) {
  return search.redirect ?? defaultAppRedirect;
}

export function continueWebAuth(
  search: AuthSearch,
  assign: (destination: string) => void = (destination) =>
    window.location.assign(destination),
) {
  assign(getAuthRedirect(search));
}

function parseAppRedirect(value: unknown) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return null;
  }

  try {
    const url = new URL(value, redirectValidationOrigin);

    if (
      url.origin !== redirectValidationOrigin ||
      (url.pathname !== "/app" && !url.pathname.startsWith("/app/"))
    ) {
      return null;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
