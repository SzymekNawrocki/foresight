import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createGroqLlm } from "./groq.js";
import type { LlmRequest } from "./llm.js";

const Answer = z.strictObject({ weight: z.int().min(1).max(3) });

const request: LlmRequest<z.infer<typeof Answer>> = {
  model: "openai/gpt-oss-20b",
  messages: [
    { role: "system", content: "Rate it." },
    { role: "user", content: "<event>…</event>" },
  ],
  schema: { name: "answer", zod: Answer },
  maxCompletionTokens: 500,
};

const completion = (content: string, usage: unknown = { prompt_tokens: 300, completion_tokens: 120, total_tokens: 420 }) =>
  Response.json({ choices: [{ message: { role: "assistant", content } }], usage });

const llmWith = (fetch: typeof globalThis.fetch) => createGroqLlm({ apiKey: "test-key", fetch, timeoutMs: 1_000 });

describe("createGroqLlm", () => {
  it("returns the validated answer with the tokens it spent", async () => {
    const fetch = vi.fn(async () => completion(JSON.stringify({ weight: 2 })));

    await expect(llmWith(fetch).complete(request)).resolves.toEqual({
      ok: true,
      data: { weight: 2 },
      usage: { model: "openai/gpt-oss-20b", tokens: 420 },
    });
  });

  it("asks for strict structured output without tools, streaming or reasoning text", async () => {
    let url: RequestInfo | URL | undefined;
    let init: RequestInit | undefined;
    const fetch = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      url = input;
      init = options;
      return completion(JSON.stringify({ weight: 1 }));
    });
    await llmWith(fetch).complete({ ...request, model: "openai/gpt-oss-120b" });

    const body = JSON.parse(String(init?.body));
    expect(String(url)).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer test-key");
    expect(body.model).toBe("openai/gpt-oss-120b");
    expect(body.max_completion_tokens).toBe(500);
    expect(body.response_format).toEqual({
      type: "json_schema",
      json_schema: {
        name: "answer",
        strict: true,
        schema: {
          type: "object",
          properties: { weight: { type: "integer" } },
          required: ["weight"],
          additionalProperties: false,
        },
      },
    });
    expect(body.include_reasoning).toBe(false);
    expect(body).not.toHaveProperty("tools");
    expect(body.stream).not.toBe(true);
  });

  it.each([
    ["not JSON", "Sure! Here is the analysis:"],
    ["wrong shape", JSON.stringify({ weight: 9 })],
    ["extra field", JSON.stringify({ weight: 1, html: "<img onerror=alert(1)>" })],
  ])("rejects an answer that is %s but still reports the spent tokens", async (_, content) => {
    const fetch = vi.fn(async () => completion(content));

    await expect(llmWith(fetch).complete(request)).resolves.toEqual({
      ok: false,
      reason: "invalid",
      usage: { model: "openai/gpt-oss-20b", tokens: 420 },
    });
  });

  it("rejects an answer without a usage report — its spend could not be counted", async () => {
    const fetch = vi.fn(async () => completion(JSON.stringify({ weight: 2 }), null));

    await expect(llmWith(fetch).complete(request)).resolves.toEqual({ ok: false, reason: "invalid" });
  });

  it("reports rate limiting separately so callers can stop", async () => {
    const fetch = vi.fn(async () => new Response("slow down", { status: 429 }));

    await expect(llmWith(fetch).complete(request)).resolves.toEqual({ ok: false, reason: "rate-limited" });
  });

  it("reports other HTTP errors", async () => {
    const fetch = vi.fn(async () => new Response("oops", { status: 503 }));

    await expect(llmWith(fetch).complete(request)).resolves.toEqual({ ok: false, reason: "http-503" });
  });

  it("names Groq's error code, so a rejected schema differs from a rejected answer", async () => {
    const fetch = vi.fn(async () =>
      Response.json(
        { error: { message: "Failed to validate JSON.", type: "invalid_request_error", code: "json_validate_failed", failed_generation: "{…}" } },
        { status: 400 },
      ),
    );

    await expect(llmWith(fetch).complete(request)).resolves.toEqual({ ok: false, reason: "http-400:json_validate_failed" });
  });

  it("keeps only a short label from the error code — it ends up in logs and metrics", async () => {
    const fetch = vi.fn(async () => Response.json({ error: { code: "Bad Code!\n<script>".repeat(10) } }, { status: 400 }));

    const result = await llmWith(fetch).complete(request);
    expect(result).toMatchObject({ ok: false });
    expect(result.ok || result.reason).toMatch(/^http-400:[a-z0-9_]{1,40}$/);
  });

  it("reports a timeout", async () => {
    const fetch = vi.fn(async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    });

    await expect(llmWith(fetch).complete(request)).resolves.toEqual({ ok: false, reason: "timeout" });
  });
});
