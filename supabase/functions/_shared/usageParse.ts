// Pure helpers for provider token usage (no Deno imports, tested by vitest).
export type TokenUsage = { input: number; output: number; total: number };

/** Read usage from an OpenAI-compatible chunk/body. Returns null when the provider sent none. */
export function usageFromOpenAi(j: any): TokenUsage | null {
  const u = j?.usage;
  if (!u || typeof u !== "object") return null;
  const input = Number(u.prompt_tokens ?? u.input_tokens);
  const output = Number(u.completion_tokens ?? u.output_tokens);
  if (!Number.isFinite(input) && !Number.isFinite(output)) return null;
  const i = Number.isFinite(input) ? input : 0, o = Number.isFinite(output) ? output : 0;
  const total = Number(u.total_tokens);
  return { input: i, output: o, total: Number.isFinite(total) && total >= i + o ? total : i + o };
}

/** Google usageMetadata -> OpenAI usage object (reasoning tokens count as output). */
export function geminiUsageToOpenAi(m: any) {
  if (!m || typeof m !== "object") return null;
  const prompt = Number(m.promptTokenCount) || 0;
  const completion = (Number(m.candidatesTokenCount) || 0) + (Number(m.thoughtsTokenCount) || 0);
  const total = Number(m.totalTokenCount) || prompt + completion;
  if (!prompt && !completion && !total) return null;
  return { prompt_tokens: prompt, completion_tokens: completion, total_tokens: Math.max(total, prompt + completion) };
}

export function addUsage(a: TokenUsage | null, b: TokenUsage | null): TokenUsage | null {
  if (!a) return b; if (!b) return a;
  return { input: a.input + b.input, output: a.output + b.output, total: a.total + b.total };
}