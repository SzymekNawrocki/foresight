import { strictJsonSchema } from "@foresight/shared";
import type { Llm, LlmFailure, LlmRequest, LlmResult, TokenUsage } from "./llm.js";

export interface GroqOptions {
  apiKey: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

interface Completion {
  choices?: { message?: { content?: unknown } }[];
  usage?: { total_tokens?: unknown };
}

// Groq's error code tells a schema it refuses from an answer that failed its own check
// (json_validate_failed). The code is outside input, so only a short slug of it is kept.
async function httpFailure(res: Response): Promise<LlmFailure> {
  const base = `http-${res.status}` as const;
  try {
    const code = ((await res.json()) as { error?: { code?: unknown } }).error?.code;
    if (typeof code !== "string") return base;
    const slug = code.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 40);
    return slug ? `${base}:${slug}` : base;
  } catch {
    return base;
  }
}

// The model gets no tools and no streaming; its answer is forced by a strict JSON schema
// and then validated again with Zod — anything that does not match is dropped.
export function createGroqLlm({ apiKey, fetch = globalThis.fetch, timeoutMs = 30_000 }: GroqOptions): Llm {
  return {
    async complete<T>({ model, messages, schema, maxCompletionTokens }: LlmRequest<T>): Promise<LlmResult<T>> {
      let res: Response;
      try {
        res = await fetch(ENDPOINT, {
          method: "POST",
          signal: AbortSignal.timeout(timeoutMs),
          headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({
            model,
            messages,
            response_format: {
              type: "json_schema",
              json_schema: { name: schema.name, strict: true, schema: strictJsonSchema(schema.zod) },
            },
            reasoning_effort: "low",
            include_reasoning: false,
            max_completion_tokens: maxCompletionTokens,
          }),
        });
      } catch (error) {
        const timedOut = error instanceof DOMException && error.name === "TimeoutError";
        return { ok: false, reason: timedOut ? "timeout" : "network" };
      }

      if (res.status === 429) return { ok: false, reason: "rate-limited" };
      if (!res.ok) return { ok: false, reason: await httpFailure(res) };

      let body: Completion;
      try {
        body = (await res.json()) as Completion;
      } catch {
        return { ok: false, reason: "invalid" };
      }
      // Without a usage report the spend cannot be counted, so the answer is not trusted either.
      const tokens = body.usage?.total_tokens;
      if (typeof tokens !== "number") return { ok: false, reason: "invalid" };
      const usage: TokenUsage = { model, tokens };

      try {
        const content = body.choices?.[0]?.message?.content;
        const parsed = schema.zod.safeParse(typeof content === "string" ? JSON.parse(content) : undefined);
        return parsed.success ? { ok: true, data: parsed.data, usage } : { ok: false, reason: "invalid", usage };
      } catch {
        return { ok: false, reason: "invalid", usage };
      }
    },
  };
}
