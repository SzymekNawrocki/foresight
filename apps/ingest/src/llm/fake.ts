import type { Llm, LlmFailure, LlmRequest, LlmResult } from "./llm.js";

/** One scripted reply: a raw answer the model "writes", or a failure before it answers. */
export type FakeReply = { answer: unknown } | { fail: LlmFailure };

export interface FakeLlm extends Llm {
  readonly requests: LlmRequest<unknown>[];
}

// In-memory adapter for tests and local runs. Answers go through the caller's schema like real
// ones, so validation is exercised too; every answered call spends `tokensPerCall`.
export function createFakeLlm(replies: FakeReply[], tokensPerCall = 1_000): FakeLlm {
  const queue = [...replies];
  const requests: LlmRequest<unknown>[] = [];
  return {
    requests,
    async complete<T>(request: LlmRequest<T>): Promise<LlmResult<T>> {
      requests.push(request as LlmRequest<unknown>);
      const reply = queue.shift();
      if (!reply) throw new Error("FakeLlm: no reply left");
      if ("fail" in reply) return { ok: false, reason: reply.fail };
      const usage = { model: request.model, tokens: tokensPerCall };
      const parsed = request.schema.zod.safeParse(reply.answer);
      return parsed.success ? { ok: true, data: parsed.data, usage } : { ok: false, reason: "invalid", usage };
    },
  };
}
