import type { z } from "zod";

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export interface LlmRequest<T> {
  model: string;
  messages: ChatMessage[];
  /** The answer is forced to this shape (strict JSON schema) and validated with it again. */
  schema: { name: string; zod: z.ZodType<T> };
  maxCompletionTokens: number;
}

/** Tokens one call spent, reasoning included — what the free Groq limits count. */
export interface TokenUsage {
  model: string;
  tokens: number;
}

export type LlmFailure = "rate-limited" | "timeout" | "invalid" | `http-${number}` | "network";

/** `usage` is present whenever the model answered, even with an invalid answer — those tokens are spent too. */
export type LlmResult<T> = { ok: true; data: T; usage: TokenUsage } | { ok: false; reason: LlmFailure; usage?: TokenUsage };

export interface Llm {
  /** One call to the model. Never throws; every failure is a typed result. */
  complete<T>(request: LlmRequest<T>): Promise<LlmResult<T>>;
}

/** Upper bound of the tokens a request can spend: ~3 characters per prompt token plus the answer cap. */
export function estimateTokens({ messages, maxCompletionTokens }: Pick<LlmRequest<unknown>, "messages" | "maxCompletionTokens">) {
  const chars = messages.reduce((sum, m) => sum + m.content.length, 0);
  return Math.ceil(chars / 3) + maxCompletionTokens;
}
