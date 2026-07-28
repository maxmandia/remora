import type { FastifyReply, FastifyRequest } from "fastify";

import { auth, getSessionFromHeaders } from "./auth.ts";
import { logImpersonationTransition } from "./auth.observability.ts";

export async function handleAuthRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  apiPort: number,
) {
  let requestSession: Awaited<ReturnType<typeof getSessionFromHeaders>> = null;

  try {
    requestSession = await getSessionFromHeaders(request.headers);
    const url = createAuthRequestUrl(request, apiPort);
    const headers = createAuthRequestHeaders(request);
    const response = await auth.handler(
      new Request(url, {
        method: request.method,
        headers,
        ...(request.body === undefined
          ? {}
          : { body: JSON.stringify(request.body) }),
      }),
    );

    reply.status(response.status);
    forwardResponseHeaders(response, reply);

    if (response.ok) {
      await logImpersonationTransition({
        requestBody: request.body,
        requestId: request.id,
        requestUrl: request.url,
        response: response.clone(),
        session: requestSession,
      });
    }

    return reply.send(response.body ? await response.text() : null);
  } catch (error) {
    request.log.error(
      {
        actorUserId:
          requestSession?.session.impersonatedBy ??
          requestSession?.user.id ??
          null,
        effectiveUserId: requestSession?.user.id ?? null,
        error,
        requestId: request.id,
        sessionId: requestSession?.session.id ?? null,
      },
      "Authentication error",
    );

    return reply.status(500).send({
      error: "Internal authentication error",
      code: "AUTH_FAILURE",
    });
  }
}

function forwardResponseHeaders(response: Response, reply: FastifyReply) {
  response.headers.forEach((value, key) => {
    if (key !== "set-cookie") {
      reply.header(key, value);
    }
  });

  const getSetCookie = (
    response.headers as Headers & {
      getSetCookie?: () => string[];
    }
  ).getSetCookie;
  const setCookieHeaders = getSetCookie?.call(response.headers);

  if (setCookieHeaders?.length) {
    reply.header("set-cookie", setCookieHeaders);
    return;
  }

  const setCookieHeader = response.headers.get("set-cookie");

  if (setCookieHeader) {
    reply.header("set-cookie", setCookieHeader);
  }
}

function createAuthRequestUrl(request: FastifyRequest, apiPort: number) {
  const protocolHeader = request.headers["x-forwarded-proto"];
  const protocol = Array.isArray(protocolHeader)
    ? protocolHeader[0]
    : protocolHeader
      ? protocolHeader.split(",")[0]
      : "http";
  const host = request.headers.host ?? `localhost:${apiPort}`;

  return new URL(request.url, `${protocol}://${host}`);
}

function createAuthRequestHeaders(request: FastifyRequest) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }

  return headers;
}
