import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);

      if (url.pathname === "/api/switch-branch") {
        const branch = url.searchParams.get("branch");
        if (!branch) {
          return new Response(JSON.stringify({ error: "No branch specified" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(branch)) {
          return new Response(JSON.stringify({ error: "Invalid branch name" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        try {
          const { execSync } = await import("child_process");
          console.log(`[BranchSwitcher] Switching branch to ${branch}...`);
          execSync(`git checkout ${branch}`);
          return new Response(JSON.stringify({ success: true, branch }), {
            headers: { "content-type": "application/json" },
          });
        } catch (err: any) {
          console.error(err);
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      }

      if (url.pathname === "/api/current-branch") {
        try {
          const { execSync } = await import("child_process");
          const currentBranch = execSync("git branch --show-current").toString().trim();
          return new Response(JSON.stringify({ branch: currentBranch }), {
            headers: { "content-type": "application/json" },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
