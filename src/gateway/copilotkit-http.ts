/**
 * CopilotKit HTTP endpoint handler.
 *
 * Follows the same request-stage pattern as `tools-invoke-http.ts` and
 * `openai-http.ts`. Accepts POST /copilotkit, authenticates, then delegates
 * to the CopilotKit runtime which streams AG-UI events over SSE.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { loadConfig } from "../config/config.js";
import type { AuthRateLimiter } from "./auth-rate-limit.js";
import type { ResolvedGatewayAuth } from "./auth.js";
import { buildCopilotKitActions } from "./copilotkit-actions.js";
import {
  readJsonBodyOrError,
  sendJson,
  sendMethodNotAllowed,
  setSseHeaders,
  watchClientDisconnect,
} from "./http-common.js";
import {
  authorizeGatewayHttpRequestOrReply,
  resolveOpenAiCompatibleHttpOperatorScopes,
} from "./http-utils.js";
import { authorizeOperatorScopesForMethod } from "./method-scopes.js";

const DEFAULT_BODY_BYTES = 2 * 1024 * 1024;

export async function handleCopilotKitHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: {
    auth: ResolvedGatewayAuth;
    maxBodyBytes?: number;
    trustedProxies?: string[];
    allowRealIpFallback?: boolean;
    rateLimiter?: AuthRateLimiter;
  },
): Promise<boolean> {
  // Parse URL
  let url: URL;
  try {
    url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "bad_request", message: "Invalid request URL" }));
    return true;
  }

  if (url.pathname !== "/copilotkit") {
    return false;
  }

  if (req.method !== "POST") {
    sendMethodNotAllowed(res, "POST");
    return true;
  }

  // Auth
  const cfg = loadConfig();
  const requestAuth = await authorizeGatewayHttpRequestOrReply({
    req,
    res,
    auth: opts.auth,
    trustedProxies: opts.trustedProxies ?? cfg.gateway?.trustedProxies,
    allowRealIpFallback: opts.allowRealIpFallback ?? cfg.gateway?.allowRealIpFallback,
    rateLimiter: opts.rateLimiter,
  });
  if (!requestAuth) {
    return true;
  }

  const requestedScopes = resolveOpenAiCompatibleHttpOperatorScopes(req, requestAuth);
  const scopeAuth = authorizeOperatorScopesForMethod("agent", requestedScopes);
  if (!scopeAuth.allowed) {
    sendJson(res, 403, {
      ok: false,
      error: { type: "forbidden", message: `missing scope: ${scopeAuth.missingScope}` },
    });
    return true;
  }

  // Read body
  const bodyUnknown = await readJsonBodyOrError(req, res, opts.maxBodyBytes ?? DEFAULT_BODY_BYTES);
  if (bodyUnknown === undefined) {
    return true;
  }
  const body = (bodyUnknown ?? {}) as CopilotKitRequestBody;

  // Lazy-import the CopilotKit runtime to keep startup fast
  const { CopilotRuntime, copilotRuntimeNodeHttpEndpoint } = await import("@copilotkit/runtime");

  const actions = buildCopilotKitActions().map((action) => ({
    name: action.name,
    description: action.description,
    parameters: action.parameters,
    handler: async (args: Record<string, unknown>) => {
      const result = await action.handler(args);
      return JSON.stringify(result);
    },
  }));

  const runtime = new CopilotRuntime({ actions });

  // Use the CopilotKit Node HTTP endpoint handler
  const copilotHandler = copilotRuntimeNodeHttpEndpoint({
    runtime,
    endpoint: "/copilotkit",
  });

  // CopilotKit's handler expects the standard Node IncomingMessage/ServerResponse
  // and manages SSE streaming internally.
  try {
    await copilotHandler(req, res);
  } catch (err: unknown) {
    if (!res.headersSent) {
      sendJson(res, 500, {
        ok: false,
        error: { type: "internal_error", message: "CopilotKit runtime error" },
      });
    }
  }

  return true;
}

type CopilotKitRequestBody = {
  messages?: unknown[];
  actions?: unknown[];
  [key: string]: unknown;
};
