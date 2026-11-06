import { describe, it, expect } from "vitest";
import { usageFromOpenAi, geminiUsageToOpenAi, addUsage } from "../../supabase/functions/_shared/usageParse";
import { forwardUsageStream } from "../../supabase/functions/_shared/usageStream";

describe("Actual MythosAI token usage", () => {
  it("preserves input and output provider counts", () => {
    expect(usageFromOpenAi({ usage: { prompt_tokens: 123, completion_tokens: 456, total_tokens: 579 } })).toEqual({ input: 123, output: 456, total: 579 });
  });
  it("counts Google reasoning in output but never estimates from text", () => {
    expect(geminiUsageToOpenAi({ promptTokenCount: 10, candidatesTokenCount: 20, thoughtsTokenCount: 30, totalTokenCount: 60 })).toEqual({ prompt_tokens: 10, completion_tokens: 50, total_tokens: 60 });
    expect(usageFromOpenAi({ choices: [{ delta: { content: "a long answer" } }] })).toBeNull();
  });
  it("aggregates actual usage for task continuations", () => {
    expect(addUsage({ input: 10, output: 20, total: 30 }, { input: 40, output: 50, total: 90 })).toEqual({ input: 50, output: 70, total: 120 });
  });
  it("forwards text immediately and reads usage split across bytes", async () => {
    const encoder = new TextEncoder(); const forwarded: Uint8Array[] = [];
    const source = new ReadableStream<Uint8Array>({ start(c) {
      c.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'));
      c.enqueue(encoder.encode('data: {"usage":{"prompt_tokens":12,"completion_'));
      c.enqueue(encoder.encode('tokens":8,"total_tokens":20}}\n\ndata: [DONE]\n\n')); c.close();
    } });
    expect(await forwardUsageStream(source, v => forwarded.push(v))).toEqual({ input: 12, output: 8, total: 20 });
    expect(forwarded).toHaveLength(3);
  });
});