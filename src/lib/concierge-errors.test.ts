import { describe, expect, it } from "vitest";
import { classifyConciergeError, conciergeLogFields } from "./concierge-errors";

function apiError(status: number, body: unknown) {
  const err = new Error("Forbidden") as Error & { statusCode: number; responseBody: string; data: unknown };
  err.name = "AI_APICallError";
  err.statusCode = status;
  err.responseBody = JSON.stringify(body);
  err.data = body;
  return err;
}

describe("classifyConciergeError", () => {
  it("classifies the workspace credit limit 403 as credits, not unknown", () => {
    const info = classifyConciergeError(
      apiError(403, { status: 403, type: "credit_limit_reached", message: "Workspace credit limit reached" }),
    );
    expect(info.kind).toBe("credits");
    expect(info.retryable).toBe(false);
    expect(info.userMessage).toMatch(/credits/i);
    expect(info.userMessage).not.toMatch(/snag/i);
  });

  it("classifies 402 as credits", () => {
    expect(classifyConciergeError(apiError(402, { type: "insufficient_credits" })).kind).toBe("credits");
  });

  it("classifies 429 as retryable rate limit", () => {
    const info = classifyConciergeError(apiError(429, { type: "rate_limited" }));
    expect(info.kind).toBe("rate_limit");
    expect(info.retryable).toBe(true);
  });

  it("classifies 401 as auth", () => {
    expect(classifyConciergeError(apiError(401, { type: "unauthorized" })).kind).toBe("auth");
  });

  it("classifies a plain provider denial 403 as ai_denied", () => {
    expect(classifyConciergeError(apiError(403, { type: "provider_denied" })).kind).toBe("ai_denied");
  });

  it("classifies 400 as a bad request", () => {
    expect(classifyConciergeError(apiError(400, { type: "invalid_request" })).kind).toBe("ai_bad_request");
  });

  it("classifies 5xx and network errors as temporarily unavailable", () => {
    expect(classifyConciergeError(apiError(503, { type: "upstream" })).kind).toBe("ai_unavailable");
    expect(classifyConciergeError(new TypeError("fetch failed")).kind).toBe("ai_unavailable");
  });

  it("classifies aborts", () => {
    const err = new Error("The operation was aborted");
    err.name = "AbortError";
    expect(classifyConciergeError(err).kind).toBe("aborted");
  });

  it("classifies zod validation errors", () => {
    const err = new Error("invalid_enum_value");
    err.name = "ZodError";
    expect(classifyConciergeError(err).kind).toBe("validation");
  });

  it("classifies missing configuration", () => {
    expect(classifyConciergeError(new Error("Missing LOVABLE_API_KEY")).kind).toBe("config");
  });

  it("classifies tagged tool failures distinctly", () => {
    expect(classifyConciergeError(new Error("[tool:search_listings] db down")).kind).toBe("tool_catalogue");
    const swiggy = classifyConciergeError(new Error("[tool:swiggy] session expired"));
    expect(swiggy.kind).toBe("tool_swiggy");
    expect(swiggy.userMessage).toMatch(/vybz catalogue/i);
  });

  it("falls back to unknown for unrecognised errors", () => {
    const info = classifyConciergeError(new Error("weird"));
    expect(info.kind).toBe("unknown");
    expect(info.userMessage).toMatch(/snag/i);
  });

  it("log fields never carry provider bodies or message text", () => {
    const fields = conciergeLogFields(
      classifyConciergeError(apiError(403, { type: "credit_limit_reached", details: "secret-ish detail" })),
      "stream",
      "run-1",
    );
    expect(fields).toEqual({
      at: "concierge",
      scope: "stream",
      kind: "credits",
      retryable: false,
      status: 403,
      providerType: "credit_limit_reached",
      runId: "run-1",
    });
    expect(JSON.stringify(fields)).not.toMatch(/secret-ish/);
  });
});
