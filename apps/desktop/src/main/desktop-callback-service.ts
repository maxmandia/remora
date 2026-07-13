import { randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";

const callbackHost = "127.0.0.1";
const authCallbackLifetimeMs = 5 * 60 * 1000;
const checkoutCallbackLifetimeMs = 24 * 60 * 60 * 1000;

type DesktopCallbackKind = "auth" | "checkout";

type PendingCallback = {
  expiresAt: number;
  handle: (url: URL) => Promise<void> | void;
  handleExpired?: () => Promise<void> | void;
  kind: DesktopCallbackKind;
  timer: NodeJS.Timeout;
};

type DesktopCallbackServiceOptions = {
  createNonce?: () => string;
  now?: () => number;
};

export class DesktopCallbackService {
  private readonly callbacks = new Map<string, PendingCallback>();
  private readonly createNonce: () => string;
  private readonly now: () => number;
  private server: Server | null = null;
  private port: number | null = null;
  private startPromise: Promise<void> | null = null;
  private stopped = false;

  constructor(options: DesktopCallbackServiceOptions = {}) {
    this.createNonce =
      options.createNonce ?? (() => randomBytes(32).toString("base64url"));
    this.now = options.now ?? Date.now;
  }

  async createAuthCallback(
    handle: (url: URL) => Promise<void> | void,
    handleExpired?: () => Promise<void> | void,
  ): Promise<URL> {
    for (const [nonce, callback] of this.callbacks) {
      if (callback.kind === "auth") {
        clearTimeout(callback.timer);
        this.callbacks.delete(nonce);
      }
    }

    return this.createCallback(
      "auth",
      authCallbackLifetimeMs,
      handle,
      handleExpired,
    );
  }

  async createCheckoutCallback(
    handle: (url: URL) => Promise<void> | void,
  ): Promise<URL> {
    return this.createCallback("checkout", checkoutCallbackLifetimeMs, handle);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    for (const callback of this.callbacks.values()) {
      clearTimeout(callback.timer);
    }
    this.callbacks.clear();

    const server = this.server;
    const startPromise = this.startPromise;

    if (server && startPromise && !server.listening) {
      await startPromise.catch(() => undefined);
    }

    this.startPromise = null;
    this.port = null;
    this.server = null;

    if (!server?.listening) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  private async createCallback(
    kind: DesktopCallbackKind,
    lifetimeMs: number,
    handle: (url: URL) => Promise<void> | void,
    handleExpired?: () => Promise<void> | void,
  ) {
    if (this.stopped) {
      throw new Error("Desktop callback service has stopped");
    }

    await this.start();

    if (this.stopped) {
      throw new Error("Desktop callback service has stopped");
    }

    const nonce = this.createUniqueNonce();
    const callback: PendingCallback = {
      expiresAt: this.now() + lifetimeMs,
      handle,
      ...(handleExpired ? { handleExpired } : {}),
      kind,
      timer: setTimeout(() => {
        void this.expireCallback(nonce, callback);
      }, lifetimeMs),
    };
    callback.timer.unref();
    this.callbacks.set(nonce, callback);

    return new URL(
      `/callbacks/${kind}/${encodeURIComponent(nonce)}`,
      `http://${callbackHost}:${this.port}`,
    );
  }

  private createUniqueNonce() {
    let nonce = this.createNonce();

    while (this.callbacks.has(nonce)) {
      nonce = this.createNonce();
    }

    return nonce;
  }

  private async start() {
    if (this.server?.listening) {
      return;
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    const server = createServer((request, response) => {
      void this.handleRequest(request.method, request.url, response);
    });
    this.server = server;
    this.startPromise = new Promise<void>((resolve, reject) => {
      const handleError = (error: Error) => {
        server.off("listening", handleListening);
        this.server = null;
        this.startPromise = null;
        reject(error);
      };
      const handleListening = () => {
        server.off("error", handleError);
        const address = server.address();

        if (!address || typeof address === "string") {
          server.close();
          this.server = null;
          this.startPromise = null;
          reject(new Error("Desktop callback listener did not bind a port"));
          return;
        }

        this.port = address.port;
        server.unref();
        resolve();
      };

      server.once("error", handleError);
      server.once("listening", handleListening);
      server.listen(0, callbackHost);
    });

    return this.startPromise;
  }

  private async handleRequest(
    method: string | undefined,
    requestUrl: string | undefined,
    response: import("node:http").ServerResponse,
  ) {
    if (method !== "GET") {
      this.respond(response, 405, "Callback rejected", "Use the link again.");
      return;
    }

    const parsed = this.parseCallbackUrl(requestUrl);

    if (!parsed) {
      this.respond(response, 404, "Callback not found", "Return to Remora.");
      return;
    }

    const callback = this.callbacks.get(parsed.nonce);

    if (!callback || callback.kind !== parsed.kind) {
      this.respond(
        response,
        404,
        "Callback not found",
        "Return to Remora and try again.",
      );
      return;
    }

    this.callbacks.delete(parsed.nonce);
    clearTimeout(callback.timer);

    if (callback.expiresAt <= this.now()) {
      await this.notifyExpired(callback);
      this.respond(
        response,
        410,
        "Callback expired",
        "Return to Remora and try again.",
      );
      return;
    }

    try {
      await callback.handle(parsed.url);
      this.respond(
        response,
        200,
        "Returned to Remora",
        "This local callback page is only used during development. You can close this window.",
      );
    } catch {
      this.respond(
        response,
        500,
        "Unable to return to Remora",
        "Return to Remora and try again.",
      );
    }
  }

  private async expireCallback(nonce: string, callback: PendingCallback) {
    if (this.callbacks.get(nonce) !== callback) {
      return;
    }

    this.callbacks.delete(nonce);
    await this.notifyExpired(callback);
  }

  private async notifyExpired(callback: PendingCallback) {
    try {
      await callback.handleExpired?.();
    } catch {
      // Expiration cleanup must not surface as an unhandled listener error.
    }
  }

  private parseCallbackUrl(requestUrl: string | undefined) {
    if (!requestUrl || this.port === null) {
      return null;
    }

    try {
      const url = new URL(requestUrl, `http://${callbackHost}:${this.port}`);

      if (url.origin !== `http://${callbackHost}:${this.port}`) {
        return null;
      }

      const match = url.pathname.match(
        /^\/callbacks\/(auth|checkout)\/([A-Za-z0-9_-]+)$/,
      );

      if (!match) {
        return null;
      }

      return {
        kind: match[1] as DesktopCallbackKind,
        nonce: match[2] as string,
        url,
      };
    } catch {
      return null;
    }
  }

  private respond(
    response: import("node:http").ServerResponse,
    status: number,
    title: string,
    message: string,
  ) {
    response.writeHead(status, {
      "content-security-policy":
        "default-src 'none'; style-src 'unsafe-inline'",
      "content-type": "text/html; charset=utf-8",
      "x-content-type-options": "nosniff",
    });
    response.end(
      `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body><main><h1>${title}</h1><p>${message}</p></main></body></html>`,
    );
  }
}
