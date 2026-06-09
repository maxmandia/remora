import type {
  DesktopTrpcFetchRequest,
  DesktopTrpcFetchResponse,
} from "../shared/trpc.ts";

type DesktopTrpcFetchHandlerOptions = {
  apiOrigin: string;
  fetch: typeof globalThis.fetch;
  getSessionCookie: () => Promise<string | null>;
};

export function createDesktopTrpcFetchHandler({
  apiOrigin,
  fetch,
  getSessionCookie,
}: DesktopTrpcFetchHandlerOptions) {
  return async (
    request: DesktopTrpcFetchRequest,
  ): Promise<DesktopTrpcFetchResponse> => {
    const method = request.method.toUpperCase();

    if (method !== "GET" && method !== "POST") {
      throw new Error("Unsupported tRPC request method.");
    }

    const url = getValidatedTrpcUrl(apiOrigin, request.url);
    const headers = getForwardedHeaders(request.headers);
    const sessionCookie = await getSessionCookie();

    if (sessionCookie) {
      headers.set("cookie", sessionCookie);
    }

    const response = await fetch(url, {
      method,
      headers,
      body: method === "GET" ? undefined : (request.body ?? undefined),
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers: Array.from(response.headers.entries()),
      body: await response.text(),
    };
  };
}

function getValidatedTrpcUrl(apiOrigin: string, rawUrl: string) {
  const apiUrl = new URL(apiOrigin);
  const url = new URL(rawUrl, apiUrl);
  const isTrpcPath =
    url.pathname === "/trpc" || url.pathname.startsWith("/trpc/");

  if (url.origin !== apiUrl.origin || !isTrpcPath) {
    throw new Error("Unsupported tRPC request URL.");
  }

  return url;
}

function getForwardedHeaders(headers: Record<string, string>) {
  const forwardedHeaders = new Headers();
  const allowedHeaders = new Set(["accept", "content-type", "trpc-accept"]);

  for (const [key, value] of Object.entries(headers)) {
    const normalizedKey = key.toLowerCase();

    if (allowedHeaders.has(normalizedKey)) {
      forwardedHeaders.set(normalizedKey, value);
    }
  }

  return forwardedHeaders;
}
