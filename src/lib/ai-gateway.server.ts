import { createOpenAI } from "@ai-sdk/openai";

const RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

/** Captures the gateway-minted run id and resends it on follow-up calls within one request. */
export function createLovableAiGatewayRunIdFetch(initialRunId?: string | null) {
  let runId: string | null = initialRunId ?? null;
  const wrapped: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    if (runId) headers.set(RUN_ID_HEADER, runId);
    const res = await fetch(input, { ...init, headers });
    const minted = res.headers.get(RUN_ID_HEADER);
    if (minted) runId = minted;
    return res;
  };
  return { fetch: wrapped, getRunId: () => runId };
}

export function getLovableAiGatewayRunId(request: Request) {
  return request.headers.get(RUN_ID_HEADER);
}

export function withLovableAiGatewayRunIdHeader(response: Response, runIdFetch: { getRunId: () => string | null }) {
  const id = runIdFetch.getRunId();
  if (!id) return response;
  const headers = new Headers(response.headers);
  headers.set(RUN_ID_HEADER, id);
  headers.set("Access-Control-Expose-Headers", RUN_ID_HEADER);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function createLovableResponsesProvider(apiKey: string, runIdFetch: { fetch: typeof fetch }) {
  return createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
}
