import { Analysis, analysisJsonSchema } from "@foresight/shared";
import type { Analyzer, AnalysisResult } from "./analyzer.js";
import { buildMessages } from "./prompt.js";

export interface GroqOptions {
  apiKey: string;
  fetch?: typeof globalThis.fetch;
  model?: string;
  timeoutMs?: number;
}

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

// The model gets no tools and no streaming; its answer is forced by a strict JSON schema
// and then validated again with Zod — anything that does not match is dropped.
export function createGroqAnalyzer({
  apiKey,
  fetch = globalThis.fetch,
  model = "openai/gpt-oss-20b",
  timeoutMs = 30_000,
}: GroqOptions): Analyzer {
  return {
    async analyze(event): Promise<AnalysisResult> {
      let res: Response;
      try {
        res = await fetch(ENDPOINT, {
          method: "POST",
          signal: AbortSignal.timeout(timeoutMs),
          headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({
            model,
            messages: buildMessages(event),
            response_format: {
              type: "json_schema",
              json_schema: { name: "analysis", strict: true, schema: analysisJsonSchema },
            },
            reasoning_effort: "low",
            include_reasoning: false,
            max_completion_tokens: 2_000,
          }),
        });
      } catch (error) {
        const timedOut = error instanceof DOMException && error.name === "TimeoutError";
        return { ok: false, reason: timedOut ? "timeout" : "network" };
      }

      if (res.status === 429) return { ok: false, reason: "rate-limited" };
      if (!res.ok) return { ok: false, reason: `http-${res.status}` };

      try {
        const body = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
        const content = body.choices?.[0]?.message?.content;
        const parsed = Analysis.safeParse(typeof content === "string" ? JSON.parse(content) : undefined);
        return parsed.success ? { ok: true, analysis: parsed.data } : { ok: false, reason: "invalid" };
      } catch {
        return { ok: false, reason: "invalid" };
      }
    },
  };
}
