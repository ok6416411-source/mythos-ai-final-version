import { generateChatCompletion, streamChatCompletion, type OpenAIChatMessage, type OpenAIModernChatFields, type GeminiChatFields } from "npm:@lovable.dev/ai-gateway@0.1.11";

type LegacyMessage = { role?: string; content?: unknown };
// Preserve text and image attachments while rejecting unrecognized content blocks.
function messagesOf(value: unknown): OpenAIChatMessage[] {
  if (!Array.isArray(value)) throw new Error("messages required");
  return value.map((m: LegacyMessage): OpenAIChatMessage => {
    const role = m.role === "assistant" ? "assistant" : m.role === "system" || m.role === "developer" ? "system" : "user";
    if (typeof m.content === "string") return { role, content: m.content };
    if (role !== "user") return { role, content: "" };
    const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [];
    for (const p of Array.isArray(m.content) ? m.content : []) {
      if (p?.type === "text" && typeof p.text === "string") content.push({ type: "text", text: p.text });
      if (p?.type === "image_url" && typeof p.image_url?.url === "string") content.push({ type: "image_url", image_url: { url: p.image_url.url } });
    }
    return { role: "user", content };
  });
}

/** Typed SDK adapter for the existing text model selection. Images retain their separate integration. */
export async function gatewayChat(body: Record<string, unknown>): Promise<Response> {
  const messages = messagesOf(body.messages);
  const effort = body.reasoning_effort === "high" || body.reasoning_effort === "medium" || body.reasoning_effort === "low" || body.reasoning_effort === "none" ? body.reasoning_effort : undefined;
  const openai: OpenAIModernChatFields = { messages, stream_options: { include_usage: true }, reasoning_effort: effort,
    ...(typeof body.max_completion_tokens === "number" ? { max_completion_tokens: body.max_completion_tokens } : {}) };
  const google: GeminiChatFields = { messages, stream_options: { include_usage: true },
    ...(typeof body.max_tokens === "number" ? { max_tokens: body.max_tokens } : {}),
    ...(typeof body.temperature === "number" ? { temperature: body.temperature } : {}) };
  // Literal slugs select generated model contracts without unsafe payload casts.
  const streaming = body.stream === true;
  switch (body.model) {
    case "openai/gpt-5.6-sol": return streaming ? (await streamChatCompletion({ model: "openai/gpt-5.6-sol", ...openai })).toResponse() : Response.json(await generateChatCompletion({ model: "openai/gpt-5.6-sol", ...openai }));
    case "openai/gpt-5.6-luna": return streaming ? (await streamChatCompletion({ model: "openai/gpt-5.6-luna", ...openai })).toResponse() : Response.json(await generateChatCompletion({ model: "openai/gpt-5.6-luna", ...openai }));
    case "openai/gpt-5.6-terra": return streaming ? (await streamChatCompletion({ model: "openai/gpt-5.6-terra", ...openai })).toResponse() : Response.json(await generateChatCompletion({ model: "openai/gpt-5.6-terra", ...openai }));
    case "openai/gpt-5.4": return streaming ? (await streamChatCompletion({ model: "openai/gpt-5.4", ...openai })).toResponse() : Response.json(await generateChatCompletion({ model: "openai/gpt-5.4", ...openai }));
    case "openai/gpt-5.4-mini": return streaming ? (await streamChatCompletion({ model: "openai/gpt-5.4-mini", ...openai })).toResponse() : Response.json(await generateChatCompletion({ model: "openai/gpt-5.4-mini", ...openai }));
    case "openai/gpt-5.4-nano": return streaming ? (await streamChatCompletion({ model: "openai/gpt-5.4-nano", ...openai })).toResponse() : Response.json(await generateChatCompletion({ model: "openai/gpt-5.4-nano", ...openai }));
    case "openai/gpt-5.5": return streaming ? (await streamChatCompletion({ model: "openai/gpt-5.5", ...openai })).toResponse() : Response.json(await generateChatCompletion({ model: "openai/gpt-5.5", ...openai }));
    case "google/gemini-3.1-flash-lite": return streaming ? (await streamChatCompletion({ model: "google/gemini-3.1-flash-lite", ...google })).toResponse() : Response.json(await generateChatCompletion({ model: "google/gemini-3.1-flash-lite", ...google }));
    case "google/gemini-3.1-pro-preview": return streaming ? (await streamChatCompletion({ model: "google/gemini-3.1-pro-preview", ...google })).toResponse() : Response.json(await generateChatCompletion({ model: "google/gemini-3.1-pro-preview", ...google }));
    case "google/gemini-3.6-flash": return streaming ? (await streamChatCompletion({ model: "google/gemini-3.6-flash", ...google })).toResponse() : Response.json(await generateChatCompletion({ model: "google/gemini-3.6-flash", ...google }));
    case "google/gemini-3.7-flash": return streaming ? (await streamChatCompletion({ model: "google/gemini-3.7-flash", ...google })).toResponse() : Response.json(await generateChatCompletion({ model: "google/gemini-3.7-flash", ...google }));
    default: throw new Error("Unsupported text model");
  }
}