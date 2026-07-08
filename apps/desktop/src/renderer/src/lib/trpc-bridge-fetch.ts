import type { DesktopTrpcFetchRequest } from "../../../shared/trpc.ts";
import {
  addFailedBackendRequestBreadcrumb,
  getBackendTraceBreadcrumbFields,
} from "./observability.ts";

export async function desktopTrpcFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const method = getRequestMethod(input, init);
  const headers = getRequestHeaders(input, init);
  const body = await getRequestBody(input, init, method);
  const request: DesktopTrpcFetchRequest = {
    url: getRequestUrl(input),
    method,
    headers: Object.fromEntries(headers.entries()),
    body,
  };
  const response = await window.remoraTrpc.fetch(request);
  const fetchResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });

  if (!fetchResponse.ok) {
    addFailedBackendRequestBreadcrumb({
      url: request.url,
      method,
      status: fetchResponse.status,
      ...getBackendTraceBreadcrumbFields(fetchResponse),
    });
  }

  return fetchResponse;
}

function getRequestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

function getRequestMethod(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
) {
  return (
    init?.method ?? (input instanceof Request ? input.method : "GET")
  ).toUpperCase();
}

function getRequestHeaders(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
) {
  const headers = new Headers(
    input instanceof Request ? input.headers : undefined,
  );

  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}

async function getRequestBody(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  method: string,
) {
  if (method === "GET" || method === "HEAD") {
    return null;
  }

  if (typeof init?.body === "string") {
    return init.body;
  }

  if (init?.body instanceof URLSearchParams) {
    return init.body.toString();
  }

  if (input instanceof Request) {
    return input.clone().text();
  }

  if (init?.body === undefined || init.body === null) {
    return null;
  }

  throw new TypeError("Unsupported tRPC request body.");
}
