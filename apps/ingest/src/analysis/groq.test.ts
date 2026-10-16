import { describe, expect, it, vi } from "vitest";
import { createGroqAnalyzer } from "./groq.js";
import { validAnalysis } from "./fixtures.js";

const event = {
  id: "0123456789abcdef0123456789abcdef",
  source: "al-jazeera",
  title: "Iran threatens to close the Strait of Hormuz",
  url: "https://www.aljazeera.com/news/1",
  publishedAt: "2026-10-16T10:00:00.000Z",
  fetchedAt: "2026-10-16T11:00:00.000Z",
};

const completion = (content: string) =>
  Response.json({ choices: [{ message: { role: "assistant", content } }] });

const analyzerWith = (fetch: typeof globalThis.fetch) =>
  createGroqAnalyzer({ apiKey: "test-key", fetch, timeoutMs: 1_000 });

describe("createGroqAnalyzer", () => {
  it("returns a validated Analysis", async () => {
    const fetch = vi.fn(async () => completion(JSON.stringify(validAnalysis)));

    await expect(analyzerWith(fetch).analyze(event)).resolves.toEqual({ ok: true, analysis: validAnalysis });
  });

  it("asks for strict structured output from gpt-oss-20b without tools or streaming", async () => {
    let url: RequestInfo | URL | undefined;
    let init: RequestInit | undefined;
    const fetch = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      url = input;
      init = options;
      return completion(JSON.stringify(validAnalysis));
    });
    await analyzerWith(fetch).analyze(event);

    const body = JSON.parse(String(init?.body));
    expect(String(url)).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer test-key");
    expect(body.model).toBe("openai/gpt-oss-20b");
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.include_reasoning).toBe(false);
    expect(body).not.toHaveProperty("tools");
    expect(body.stream).not.toBe(true);
  });

  it.each([
    ["not JSON", "Sure! Here is the analysis:"],
    ["wrong shape", JSON.stringify({ ...validAnalysis, weight: 9 })],
    ["extra field", JSON.stringify({ ...validAnalysis, html: "<img onerror=alert(1)>" })],
  ])("rejects an answer that is %s", async (_, content) => {
    const fetch = vi.fn(async () => completion(content));

    await expect(analyzerWith(fetch).analyze(event)).resolves.toEqual({ ok: false, reason: "invalid" });
  });

  it("reports rate limiting separately so the batch can stop", async () => {
    const fetch = vi.fn(async () => new Response("slow down", { status: 429 }));

    await expect(analyzerWith(fetch).analyze(event)).resolves.toEqual({ ok: false, reason: "rate-limited" });
  });

  it("reports other HTTP errors", async () => {
    const fetch = vi.fn(async () => new Response("oops", { status: 503 }));

    await expect(analyzerWith(fetch).analyze(event)).resolves.toEqual({ ok: false, reason: "http-503" });
  });

  it("reports a timeout", async () => {
    const fetch = vi.fn(async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    });

    await expect(analyzerWith(fetch).analyze(event)).resolves.toEqual({ ok: false, reason: "timeout" });
  });
});
