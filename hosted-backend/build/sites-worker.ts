import handler from "vinext/server/fetch-handler";
import { gate, handleHostedRequest } from "../server/hosted-api.mjs";
import { getSiteFile } from "../server/hosted-site-files.mjs";
import { withApiCors } from "../server/hosted-cors.mjs";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    try {
      const denied = await gate(request, env);
      if (denied) return protect(denied);
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) return protect(await handleHostedRequest(request, env));
      if (!["GET", "HEAD"].includes(request.method)) return protect(new Response("Method not allowed", {status:405}));
      if (url.pathname === "/studio") return protect(Response.redirect(new URL("/studio/" + url.search, url), 302));
      return protect(await getSiteFile(request, env));
    } catch (error) {
      console.error("Hosted demo request failed", error instanceof Error ? error.message : "Unknown error");
      return protect(withApiCors(request, new Response("The demo is temporarily unavailable. Please try again.", {status:503})));
    }
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
  },
};

function protect(response: Response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  headers.set("Referrer-Policy", "same-origin");
  if (!headers.has("Content-Security-Policy")) headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://*.tile.openstreetmap.org; media-src 'self' blob:; connect-src 'self' https://unpkg.com https://cdnjs.cloudflare.com; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'");
  return new Response(response.body, {status:response.status, statusText:response.statusText, headers});
}
