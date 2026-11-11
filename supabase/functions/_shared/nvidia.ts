// NVIDIA NIM (build.nvidia.com) als zweite, kostenlose Modell-Quelle neben Google AI Studio.
// OpenAI-kompatibel, ~40 Anfragen/Minute je Modell, oft ausgelastet -> mehrere Modelle + Abkühlzeiten.
// Die Modellnamen ändern sich laufend, deshalb wird der Katalog live gelesen und per Muster das
// jeweils stärkste verfügbare Modell gewählt. Schlüssel: Secret NVIDIA_API_KEY oder /nvidiakeyadmin.
import { createClient } from "npm:@supabase/supabase-js@2.103.3";

const NV = "https://integrate.api.nvidia.com/v1";
export type Tier = "strong" | "mid" | "fast";

let keyCache: { at: number; keys: string[] } | null = null;
export async function nvidiaKeys(): Promise<string[]> {
  if (keyCache && Date.now() - keyCache.at < 5 * 60_000) return keyCache.keys;
  const keys = [Deno.env.get("NVIDIA_API_KEY"), Deno.env.get("NVIDIA_API_KEY_BACKUP")].filter((k): k is string => !!k && k.length > 10);
  if (!keys.length) {
    try {
      const url = Deno.env.get("SUPABASE_URL"), sr = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (url && sr) {
        const { data } = await createClient(url, sr).from("app_secrets").select("name, value").in("name", ["NVIDIA_API_KEY", "NVIDIA_API_KEY_BACKUP"]);
        for (const r of data ?? []) if (r.value && r.value.length > 10) keys.push(r.value);
      }
    } catch (e) { console.warn("[nvidia] key lookup failed", e instanceof Error ? e.message : String(e)); }
  }
  keyCache = { at: Date.now(), keys };
  return keys;
}

// Nichts, was kein reines Text-/Chat-Modell ist.
const NOT_CHAT = /embed|rerank|guard|safety|(^|[-_/])vl([-_]|$)|vision|omni|tts|asr|audio|speech|image|video|clip|parakeet|retriev|ocr|translat|pii|detect|bge|starcoder|fuyu|kosmos|neva|deplot|paligemma|riva|canary|magpie|flux|diffusion|cosmos|usdcode|nv-|chatqa|reward|gliner/i;
// Reihenfolge = Vorliebe. Je Muster wird das neueste passende Modell genommen.
const PREFS: Record<"strong" | "fast", RegExp[]> = {
  strong: [
    /deepseek-v[4-9][^/]*pro|deepseek-v[4-9]/i, /glm-[5-9](?!.*(flash|air|lite))/i, /kimi-k[2-9]/i, /qwen[^/]*coder/i,
    /minimax-m[2-9](?!.*(flash|lite))/i, /nemotron-[3-9][^/]*ultra/i, /mistral-large-[3-9]/i, /qwen-?(3\.[5-9]|[4-9])(?!.*(flash|lite|small))/i,
    /step-[5-9]/i, /nemotron-[3-9][^/]*super/i, /gpt-oss-120b/i, /deepseek/i, /llama-4|llama-3\.3-70b/i,
  ],
  fast: [/glm-[5-9][^/]*flash/i, /minimax[^/]*flash/i, /nemotron[^/]*(bolt|nano)/i, /gpt-oss-20b/i, /gemma-[4-9]/i, /llama[^/]*8b/i],
};
const STATIC: Record<"strong" | "fast", string[]> = {
  strong: ["deepseek-ai/deepseek-v4-pro", "z-ai/glm-5.3", "moonshotai/kimi-k2-instruct-0905", "qwen/qwen3-coder-480b-a35b-instruct", "nvidia/nemotron-3-ultra", "nvidia/nemotron-3-super-120b-a12b", "openai/gpt-oss-120b", "meta/llama-3.3-70b-instruct"],
  fast: ["z-ai/glm-5.3-flash", "minimaxai/minimax-m3.1-flash", "openai/gpt-oss-20b", "meta/llama-3.1-8b-instruct"],
};

/** "glm-5.10" > "glm-5.3": Zahlen als Zahlen vergleichen. */
function newer(a: string, b: string): number {
  const pa = a.split(/(\d+)/), pb = b.split(/(\d+)/);
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
    if (pa[i] === pb[i]) continue;
    const na = Number(pa[i]), nb = Number(pb[i]);
    if (pa[i] !== "" && pb[i] !== "" && !isNaN(na) && !isNaN(nb)) return nb - na;
    return pa[i] < pb[i] ? 1 : -1;
  }
  return pb.length - pa.length;
}
export function pickModels(ids: string[], kind: "strong" | "fast"): string[] {
  const chat = ids.filter((id) => !NOT_CHAT.test(id));
  const out: string[] = [];
  for (const re of PREFS[kind]) {
    const hit = chat.filter((id) => re.test(id) && !out.includes(id)).sort(newer)[0];
    if (hit) out.push(hit);
  }
  return out;
}

let catalog: { at: number; ids: string[] } | null = null;
async function catalogIds(key: string): Promise<string[]> {
  if (catalog && Date.now() - catalog.at < (catalog.ids.length ? 6 * 3600_000 : 5 * 60_000)) return catalog.ids;
  let ids: string[] = [];
  try {
    const r = await fetch(`${NV}/models`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(6000) });
    if (r.ok) ids = ((await r.json())?.data ?? []).map((m: any) => String(m?.id || "")).filter(Boolean);
    else await r.body?.cancel();
  } catch (e) { console.warn("[nvidia] catalog failed", e instanceof Error ? e.message : String(e)); }
  catalog = { at: Date.now(), ids };
  return ids;
}
export async function nvidiaModels(tier: Tier, key: string): Promise<string[]> {
  const ids = await catalogIds(key);
  const kind = tier === "fast" ? "fast" : "strong";
  const picked = ids.length ? pickModels(ids, kind) : [];
  // Schnelle Stufe: reicht das nicht, darf auch ein starkes Modell antworten.
  const more = ids.length && kind === "fast" ? pickModels(ids, "strong") : [];
  const list = [...picked, ...more];
  return (list.length ? list : STATIC[kind]).slice(0, 5);
}

/** Text ohne Bilder? Nur dann kann ein NVIDIA-Textmodell die Anfrage übernehmen. */
export function nvidiaCanHandle(body: Record<string, any>): boolean {
  if (Array.isArray(body.modalities) && body.modalities.includes("image")) return false;
  if (/image|tts|audio/i.test(String(body.model || ""))) return false;
  for (const m of Array.isArray(body.messages) ? body.messages : []) {
    if (Array.isArray(m?.content) && m.content.some((p: any) => p?.type && p.type !== "text")) return false;
  }
  return true;
}
function nvMessages(msgs: any[]): any[] {
  return msgs.map((m) => {
    const role = m.role === "developer" ? "system" : m.role;
    const content = Array.isArray(m.content) ? m.content.map((p: any) => p?.text || "").join("\n") : (m.content ?? "");
    const out: any = { role, content };
    if (m.tool_calls) out.tool_calls = m.tool_calls;
    if (m.tool_call_id) out.tool_call_id = m.tool_call_id;
    if (m.name) out.name = m.name;
    return out;
  });
}

/** Entfernt <think>…</think> aus gestückeltem Text (Denk-Modelle schreiben das mit in die Antwort). */
export function thinkStripper() {
  let inThink = false, buf = "";
  return (s: string, flush = false): string => {
    buf += s;
    let out = "";
    for (;;) {
      if (inThink) {
        const e = buf.indexOf("</think>");
        if (e < 0) { buf = flush ? "" : buf.slice(-7); return out; }
        buf = buf.slice(e + 8).replace(/^\s+/, ""); inThink = false;
      } else {
        const st = buf.indexOf("<think>");
        if (st < 0) {
          let keep = 0;
          if (!flush) for (let k = Math.min(6, buf.length); k > 0; k--) if ("<think>".startsWith(buf.slice(-k))) { keep = k; break; }
          out += buf.slice(0, buf.length - keep); buf = buf.slice(buf.length - keep);
          return out;
        }
        out += buf.slice(0, st); buf = buf.slice(st + 7); inThink = true;
      }
    }
  };
}
function cleanStream(src: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const enc = new TextEncoder(), dec = new TextDecoder();
  const strip = thinkStripper();
  let buf = "";
  const handle = (line: string, ctl: ReadableStreamDefaultController<Uint8Array>) => {
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (!data) return;
    if (data === "[DONE]") {
      const rest = strip("", true);
      if (rest) ctl.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: rest } }] })}\n\n`));
      ctl.enqueue(enc.encode("data: [DONE]\n\n")); return;
    }
    let j: any; try { j = JSON.parse(data); } catch { return; }
    const d = j?.choices?.[0]?.delta;
    if (d) {
      delete d.reasoning_content; delete d.reasoning;
      if (typeof d.content === "string") d.content = strip(d.content);
      const empty = !d.content && !d.tool_calls && !d.role && !j.choices[0].finish_reason && !j.usage;
      if (empty) return;
    }
    ctl.enqueue(enc.encode(`data: ${JSON.stringify(j)}\n\n`));
  };
  const reader = src.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(ctl) {
      const { done, value } = await reader.read();
      if (done) { if (buf.trim()) handle(buf.trim(), ctl); ctl.close(); return; }
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line) handle(line, ctl); }
    },
    cancel(r) { reader.cancel(r).catch(() => {}); },
  });
}

const cooldown = new Map<string, number>();
/** Welches Modell zuletzt geantwortet hat (für Logs/Usage). */
export let lastNvidiaModel = "";

/** Anfrage an NVIDIA: probiert die besten Modelle der Stufe der Reihe nach. null = NVIDIA nicht nutzbar/alle gescheitert. */
export async function nvidiaChat(body: Record<string, any>, tier: Tier, opts: { skip?: number; signal?: AbortSignal } = {}): Promise<Response | null> {
  const keys = await nvidiaKeys();
  if (!keys.length || !nvidiaCanHandle(body)) return null;
  const streaming = body.stream === true;
  const models = (await nvidiaModels(tier, keys[0])).slice(opts.skip || 0);
  const maxOut = Math.min(Number(body.max_tokens ?? body.max_completion_tokens) || 8192, 16000);
  const base: Record<string, any> = { messages: nvMessages(body.messages || []), max_tokens: maxOut, stream: streaming };
  if (typeof body.temperature === "number") base.temperature = body.temperature;
  if (Array.isArray(body.tools) && body.tools.length) { base.tools = body.tools; if (body.tool_choice) base.tool_choice = body.tool_choice; }
  if (body.response_format) base.response_format = body.response_format;
  const now = Date.now();
  let tries = 0;
  for (const model of models) {
    for (const key of keys) {
      const cd = model + key.slice(-6);
      if ((cooldown.get(cd) ?? 0) > now) continue;
      if (opts.signal?.aborted || ++tries > 4) return null;
      let payload: Record<string, any> = { ...base, model };
      for (let attempt = 0; attempt < 2; attempt++) {
        const ctl = new AbortController();
        const onAbort = () => ctl.abort(); opts.signal?.addEventListener("abort", onAbort, { once: true });
        // Ausgelastete Modelle hängen oft in der Warteschlange: nicht ewig auf die ersten Bytes warten.
        const timer = setTimeout(() => ctl.abort(), streaming ? 20_000 : 150_000);
        try {
          const r = await fetch(`${NV}/chat/completions`, { method: "POST", signal: ctl.signal,
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: streaming ? "text/event-stream" : "application/json" },
            body: JSON.stringify(payload) });
          clearTimeout(timer);
          if (r.ok && r.status === 200 && r.body) {
            lastNvidiaModel = model;
            if (streaming) return new Response(cleanStream(r.body), { headers: { "Content-Type": "text/event-stream", "x-mythos-provider": "nvidia", "x-mythos-model": model } });
            const j = await r.json();
            const msg = j?.choices?.[0]?.message;
            if (msg) { delete msg.reasoning_content; delete msg.reasoning; if (typeof msg.content === "string") msg.content = msg.content.replace(/<think>[\s\S]*?<\/think>\s*/g, "").replace(/^[\s\S]*?<\/think>\s*/, ""); }
            if (!msg || (!msg.content && !msg.tool_calls?.length)) { console.warn("[nvidia] leere Antwort", model); break; }
            return new Response(JSON.stringify(j), { headers: { "Content-Type": "application/json", "x-mythos-provider": "nvidia", "x-mythos-model": model } });
          }
          const info = (await r.text().catch(() => "")).slice(0, 300);
          console.warn("[nvidia] failed", model, r.status, info.slice(0, 140));
          // Sonderwünsche (JSON-Format, Werkzeuge), die das Modell nicht kann: einmal ohne versuchen bzw. nächstes Modell.
          if (r.status === 400 && attempt === 0 && payload.response_format) { payload = { ...payload }; delete payload.response_format; continue; }
          cooldown.set(cd, Date.now() + (r.status === 429 ? 60_000 : r.status === 404 || r.status === 400 || r.status === 410 || r.status === 422 ? 6 * 3600_000 : r.status === 401 || r.status === 403 ? 30 * 60_000 : 2 * 60_000));
          break;
        } catch (e) {
          clearTimeout(timer);
          if (opts.signal?.aborted) return null;
          console.warn("[nvidia] exception", model, e instanceof Error ? e.message : String(e));
          cooldown.set(cd, Date.now() + 90_000);
          break;
        } finally { opts.signal?.removeEventListener("abort", onAbort); }
      }
    }
  }
  return null;
}
