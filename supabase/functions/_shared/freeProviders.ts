// Weitere kostenlose, OpenAI-kompatible KI-Quellen: OpenRouter (:free-Modelle), Groq und Cerebras.
// Alle laufen im Rennen mit Lovable, Google und NVIDIA mit (siehe ai.ts): wer zuerst echten Text liefert, antwortet.
// Schlüssel: Secrets OPENROUTER_API_KEY, GROQ_API_KEY, CEREBRAS_API_KEY (oder Tabelle app_secrets).
// Die Modell-Listen ändern sich laufend → Katalog live lesen und per Muster das stärkste passende Modell wählen.
import { createClient } from "npm:@supabase/supabase-js@2.103.3";
import { nvidiaCanHandle, thinkStripper, type Tier } from "./nvidia.ts";

type Provider = {
  id: "openrouter" | "groq" | "cerebras";
  base: string;
  secret: string;
  /** Bevorzugte Modelle (Muster, in Reihenfolge). */
  strong: RegExp[];
  fast: RegExp[];
  /** Ersatzliste, falls der Katalog nicht lesbar ist. */
  fallback: { strong: string[]; fast: string[] };
  /** Nur diese Modelle aus dem Katalog nehmen (OpenRouter: nur kostenlose). */
  allow?: RegExp;
  headers?: Record<string, string>;
};

export const PROVIDERS: Provider[] = [
  {
    id: "openrouter", base: "https://openrouter.ai/api/v1", secret: "OPENROUTER_API_KEY", allow: /:free$/,
    strong: [/deepseek[^/]*(v3\.[1-9]|v[4-9]|r1)/i, /qwen[^/]*(3|coder)/i, /kimi-k2/i, /glm-[4-9]/i, /llama-4/i, /gpt-oss-120b/i, /llama-3\.3-70b/i, /mistral[^/]*(large|medium|small-3)/i, /gemma-3-27b/i],
    fast: [/gpt-oss-20b/i, /gemma-3-(12|27)b/i, /llama-3\.[23]-(3|8|11)b/i, /mistral[^/]*small/i, /qwen[^/]*(7b|8b|14b)/i],
    fallback: { strong: ["deepseek/deepseek-chat-v3.1:free", "qwen/qwen3-coder:free", "meta-llama/llama-3.3-70b-instruct:free"], fast: ["openai/gpt-oss-20b:free", "google/gemma-3-27b-it:free"] },
    headers: { "HTTP-Referer": "https://mythos-ai-final-versionolo.lovable.app", "X-Title": "Mythos AI" },
  },
  {
    id: "groq", base: "https://api.groq.com/openai/v1", secret: "GROQ_API_KEY",
    strong: [/kimi-k2/i, /gpt-oss-120b/i, /qwen[^/]*3/i, /llama-4-maverick/i, /llama-3\.3-70b/i, /deepseek/i],
    fast: [/gpt-oss-20b/i, /llama-4-scout/i, /llama-3\.1-8b/i],
    fallback: { strong: ["moonshotai/kimi-k2-instruct", "openai/gpt-oss-120b", "llama-3.3-70b-versatile"], fast: ["openai/gpt-oss-20b", "llama-3.1-8b-instant"] },
  },
  {
    id: "cerebras", base: "https://api.cerebras.ai/v1", secret: "CEREBRAS_API_KEY",
    strong: [/qwen-3-(coder|235b)/i, /gpt-oss-120b/i, /glm/i, /llama-4-maverick/i, /llama-3\.3-70b/i],
    fast: [/llama3?\.1-8b|llama-3\.1-8b/i, /qwen-3-32b/i, /llama-4-scout/i],
    fallback: { strong: ["gpt-oss-120b", "qwen-3-235b-a22b-instruct-2507", "llama-3.3-70b"], fast: ["llama3.1-8b", "qwen-3-32b"] },
  },
];

const NOT_CHAT = /embed|whisper|tts|audio|vision-only|guard|rerank|moderation|image|transcrib/i;

let secretCache: { at: number; map: Record<string, string> } | null = null;
async function keyOf(p: Provider): Promise<string | null> {
  const env = Deno.env.get(p.secret);
  if (env && env.length > 10) return env;
  if (!secretCache || Date.now() - secretCache.at > 5 * 60_000) {
    const map: Record<string, string> = {};
    try {
      const url = Deno.env.get("SUPABASE_URL"), sr = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (url && sr) {
        const { data } = await createClient(url, sr).from("app_secrets").select("name, value").in("name", PROVIDERS.map((x) => x.secret));
        for (const r of data ?? []) map[r.name] = r.value;
      }
    } catch { /* Tabelle fehlt – dann nur Secrets */ }
    secretCache = { at: Date.now(), map };
  }
  const v = secretCache.map[p.secret];
  return v && v.length > 10 ? v : null;
}

/** Welche Zusatz-Anbieter haben einen Schlüssel? */
export async function freeProvidersReady(): Promise<Provider[]> {
  const out: Provider[] = [];
  for (const p of PROVIDERS) if (await keyOf(p)) out.push(p);
  return out;
}

const catalogs = new Map<string, { at: number; ids: string[] }>();
async function modelsOf(p: Provider, key: string, tier: Tier): Promise<string[]> {
  let c = catalogs.get(p.id);
  if (!c || Date.now() - c.at > (c.ids.length ? 6 * 3600_000 : 5 * 60_000)) {
    let ids: string[] = [];
    try {
      const r = await fetch(`${p.base}/models`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(6000) });
      if (r.ok) ids = ((await r.json())?.data ?? []).map((m: any) => String(m?.id || "")).filter(Boolean);
      else await r.body?.cancel();
    } catch (e) { console.warn(`[${p.id}] catalog failed`, e instanceof Error ? e.message : String(e)); }
    c = { at: Date.now(), ids }; catalogs.set(p.id, c);
  }
  const ids = c.ids.filter((id) => !NOT_CHAT.test(id) && (!p.allow || p.allow.test(id)));
  const pick = (res: RegExp[]) => { const out: string[] = []; for (const re of res) { const hit = ids.find((id) => re.test(id) && !out.includes(id)); if (hit) out.push(hit); } return out; };
  const kind = tier === "fast" ? "fast" : "strong";
  const list = ids.length ? [...pick(p[kind]), ...(kind === "fast" ? pick(p.strong) : [])] : [];
  return (list.length ? list : p.fallback[kind]).slice(0, 3);
}

/** Antworttext ohne <think>-Teile; Denk-Felder entfernen. */
function cleanStream(src: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const dec = new TextDecoder(), enc = new TextEncoder(), strip = thinkStripper();
  let buf = "";
  return new ReadableStream({
    async start(c) {
      const reader = src.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i); buf = buf.slice(i + 1);
            const t = line.trim();
            if (!t.startsWith("data:")) { if (t.startsWith(":")) continue; c.enqueue(enc.encode(line + "\n")); continue; }
            const raw = t.slice(5).trim();
            if (raw === "[DONE]") { c.enqueue(enc.encode("data: [DONE]\n\n")); continue; }
            try {
              const j = JSON.parse(raw);
              const d = j?.choices?.[0]?.delta;
              if (d) { delete d.reasoning; delete d.reasoning_content; delete d.reasoning_details; if (typeof d.content === "string") d.content = strip(d.content); }
              c.enqueue(enc.encode(`data: ${JSON.stringify(j)}\n\n`));
            } catch { /* Teilzeile */ }
          }
        }
      } catch { /* abgebrochen */ }
      try { c.close(); } catch { /* zu */ }
    },
    cancel() { src.cancel().catch(() => {}); },
  });
}

const cooldown = new Map<string, number>();

/** Anfrage an einen Zusatz-Anbieter (beste Modelle der Stufe der Reihe nach). null = nicht nutzbar/gescheitert. */
export async function freeChat(p: Provider, body: Record<string, any>, tier: Tier, signal?: AbortSignal): Promise<Response | null> {
  const key = await keyOf(p);
  if (!key || !nvidiaCanHandle(body)) return null;
  const streaming = body.stream === true;
  const models = await modelsOf(p, key, tier);
  const maxOut = Math.min(Number(body.max_tokens ?? body.max_completion_tokens) || 8192, 16000);
  const messages = (body.messages || []).map((m: any) => {
    const out: any = { role: m.role === "developer" ? "system" : m.role, content: Array.isArray(m.content) ? m.content.map((x: any) => x?.text || "").join("\n") : (m.content ?? "") };
    if (m.tool_calls) out.tool_calls = m.tool_calls; if (m.tool_call_id) out.tool_call_id = m.tool_call_id; if (m.name) out.name = m.name;
    return out;
  });
  const base: Record<string, any> = { messages, max_tokens: maxOut, stream: streaming };
  if (typeof body.temperature === "number") base.temperature = body.temperature;
  if (Array.isArray(body.tools) && body.tools.length) { base.tools = body.tools; if (body.tool_choice) base.tool_choice = body.tool_choice; }
  for (const model of models) {
    const cd = p.id + model;
    if ((cooldown.get(cd) ?? 0) > Date.now()) continue;
    if (signal?.aborted) return null;
    const ctl = new AbortController();
    const onAbort = () => ctl.abort(); signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => ctl.abort(), streaming ? 20_000 : 120_000);
    try {
      const r = await fetch(`${p.base}/chat/completions`, {
        method: "POST", signal: ctl.signal,
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(p.headers || {}) },
        body: JSON.stringify({ ...base, model }),
      });
      clearTimeout(timer);
      if (r.ok && r.body) {
        const h = { "x-mythos-provider": p.id, "x-mythos-model": model };
        if (streaming) return new Response(cleanStream(r.body), { headers: { "Content-Type": "text/event-stream", ...h } });
        const j = await r.json();
        const msg = j?.choices?.[0]?.message;
        if (msg) { delete msg.reasoning; delete msg.reasoning_content; if (typeof msg.content === "string") msg.content = msg.content.replace(/<think>[\s\S]*?<\/think>\s*/g, ""); }
        if (!msg || (!msg.content && !msg.tool_calls?.length)) continue;
        return new Response(JSON.stringify(j), { headers: { "Content-Type": "application/json", ...h } });
      }
      const info = (await r.text().catch(() => "")).slice(0, 160);
      console.warn(`[${p.id}] failed`, model, r.status, info);
      cooldown.set(cd, Date.now() + (r.status === 429 ? 60_000 : r.status === 401 || r.status === 403 ? 30 * 60_000 : r.status === 404 || r.status === 400 ? 6 * 3600_000 : 2 * 60_000));
    } catch (e) {
      clearTimeout(timer);
      if (signal?.aborted) return null;
      cooldown.set(cd, Date.now() + 90_000);
      console.warn(`[${p.id}] exception`, model, e instanceof Error ? e.message : String(e));
    } finally { signal?.removeEventListener("abort", onAbort); }
  }
  return null;
}
