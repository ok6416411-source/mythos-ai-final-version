import { usageFromOpenAi, type TokenUsage } from "./usageParse.ts";

/** Observe provider usage without buffering or delaying text bytes. */
export async function forwardUsageStream(src: ReadableStream<Uint8Array>, emit: (value: Uint8Array) => void): Promise<TokenUsage | null> {
  const reader = src.getReader(), decoder = new TextDecoder();
  let buffer = "", usage: TokenUsage | null = null;
  const parse = (line: string) => {
    if (!line.startsWith("data:")) return;
    try { usage = usageFromOpenAi(JSON.parse(line.slice(5).trim())) ?? usage; } catch { /* comments, DONE */ }
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let i;
      while ((i = buffer.indexOf("\n")) >= 0) { parse(buffer.slice(0, i)); buffer = buffer.slice(i + 1); }
      // Keep the terminal marker until we have appended the normalized usage event.
      // Forward all other content immediately.
      emit(value);
    }
    parse(buffer + decoder.decode());
  } finally { reader.releaseLock(); }
  return usage;
}