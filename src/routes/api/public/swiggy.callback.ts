import { createFileRoute } from "@tanstack/react-router";

/**
 * Swiggy OAuth 2.1 redirect target. The caller is authenticated by the single-use,
 * short-lived `state` row, which carries the My Mood user id and the PKCE verifier —
 * route placement never authenticates anyone. No token is ever placed in the URL.
 */
export const Route = createFileRoute("/api/public/swiggy/callback")({ staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const oauthError = url.searchParams.get("error");

        const back = (params: Record<string, string>, path = "/food") => {
          const target = new URL(path, url.origin);
          for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
          return new Response(null, { status: 302, headers: { location: target.toString() } });
        };

        if (oauthError) return back({ swiggy: "denied", reason: oauthError.slice(0, 80) });
        if (!code || !state) return back({ swiggy: "error", reason: "missing_code" });

        const { completeAuthorization } = await import("@/lib/swiggy/oauth.server");
        try {
          const result = await completeAuthorization({ code, state });
          return back({ swiggy: "connected" }, result.returnPath);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Swiggy connection failed";
          return back({ swiggy: "error", reason: message.slice(0, 140) });
        }
      },
    },
  },
});
