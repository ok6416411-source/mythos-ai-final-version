// Shared AI helper: Lovable AI Gateway with automatic Google Gemini fallback.
// Wenn die Lovable-Credits leer sind (402), Rate-Limit (429) oder ein 5xx kommt,
// wird automatisch direkt auf die Google Generative Language API umgeschaltet
// (Primary-Key + Backup-Key). Die Schlüssel kommen entweder als Server-Secret,
// oder – falls in diesem Projekt keine Secrets-Verwaltung verfügbar ist – als per
// /apikeyadmin gespeicherter Wert in der Tabelle app_secrets (siehe nvidia/index.ts).
import { createClient } from "npm:@supabase/supabase-js@2.103.3";
import { geminiUsageToOpenAi } from "./usageParse.ts";
import { nvidiaChat, nvidiaCanHandle, nvidiaKeys, type Tier } from "./nvidia.ts";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GOOGLE_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const enc = new TextEncoder();
const sse = (obj: unknown) => enc.encode(`data: ${JSON.stringify(obj)}\n\n`);
const sseDone = () => enc.encode("data: [DONE]\n\n");

export async function googleKeys(): Promise<string[]> {
  const fromEnv = [Deno.env.get("GOOGLE_AI_API_KEY"), Deno.env.get("GOOGLE_AI_API_KEY_BACKUP")];
  if (fromEnv.every((k) => k && k.length > 5)) return fromEnv as string[];
  try {
    const url = Deno.env.get("SUPABASE_URL"), sr = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (url && sr) {
      const admin = createClient(url, sr);
      const { data } = await admin.from("app_secrets").select("name, value").in("name", ["GOOGLE_AI_API_KEY", "GOOGLE_AI_API_KEY_BACKUP"]);
      const stored: Record<string, string> = {}; for (const r of data ?? []) stored[r.name] = r.value;
      fromEnv[0] = fromEnv[0] || stored.GOOGLE_AI_API_KEY;
      fromEnv[1] = fromEnv[1] || stored.GOOGLE_AI_API_KEY_BACKUP;
    }
  } catch (e) { console.warn("[ai] app_secrets lookup failed", e instanceof Error ? e.message : String(e)); }
  return fromEnv.filter((k): k is string => !!k && k.length > 5);
}

/** Lovable-Modell-ID -> Google-Modellkette (erstes verfügbares gewinnt) */
export function geminiChain(model: string): string[] {
  const m = String(model || "").toLowerCase();
  if (m.includes("image")) return ["gemini-3.1-flash-image", "gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"];
  if (m.includes("lite") || m.includes("nano") || m.includes("luna")) {
    return ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-3.6-flash"];
  }
  if (m.includes("pro") || m.includes("ultra") || m.includes("gpt-5.5") || m.includes("sol")) {
    // pro-preview ist im Free-Tier oft quota-gesperrt -> starke Flash-Modelle als Ersatz
    return ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite"];
  }
  return ["gemini-3.6-flash", "gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite"];
}

export function mapToGemini(model: string): string {
  return geminiChain(model)[0];
}


type AnyMsg = { role: string; content: unknown };

function b64(buf: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Bild per https laden und als inlineData für Gemini liefern (z. B. Chat-Anhänge aus dem Storage). */
async function inlineFromUrl(url: string): Promise<any | null> {
  try {
    if (!/^https:\/\//i.test(url)) return null;
    const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) return null;
    const mimeType = (r.headers.get("content-type") || "").split(";")[0].trim();
    if (!/^image\/(png|jpeg|gif|webp)$/.test(mimeType)) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.length > 8_000_000) return null;
    return { inlineData: { mimeType, data: b64(buf) } };
  } catch { return null; }
}

async function partsFromContent(content: unknown): Promise<any[]> {
  if (typeof content === "string") return content ? [{ text: content }] : [];
  if (Array.isArray(content)) {
    const out: any[] = [];
    for (const p of content as any[]) {
      if (!p) continue;
      if (p.type === "text" && p.text) out.push({ text: p.text });
      else if (p.type === "image_url" && p.image_url?.url) {
        const url: string = p.image_url.url;
        const m = url.match(/^data:([^;]+);base64,(.+)$/);
        if (m) out.push({ inlineData: { mimeType: m[1], data: m[2] } });
        else {
          // Vorher wurden https-Bilder hier stillschweigend verworfen -> Gemini "sah" keine Anhänge.
          const part = await inlineFromUrl(url);
          if (part) out.push(part);
        }
      } else if (typeof p.text === "string" && p.text) out.push({ text: p.text });
    }
    return out;
  }
  return [];
}

/** OpenAI-Chat-Body -> Google GenerateContent-Body */
export async function toGeminiBody(body: Record<string, any>) {
  const msgs: AnyMsg[] = Array.isArray(body.messages) ? body.messages : [];
  const systemTexts: string[] = [];
  const contents: any[] = [];
  for (const m of msgs) {
    if (m.role === "system" || m.role === "developer") {
      const parts = await partsFromContent(m.content);
      systemTexts.push(parts.map((p) => p.text || "").join("\n"));
      continue;
    }
    if (m.role === "tool") continue;
    const parts = await partsFromContent(m.content);
    if (parts.length === 0) continue;
    contents.push({ role: m.role === "assistant" ? "model" : "user", parts });
  }
  const gen: Record<string, unknown> = {};
  const maxOut = body.max_tokens ?? body.max_completion_tokens;
  if (maxOut) gen.maxOutputTokens = maxOut;
  if (body.temperature !== undefined) gen.temperature = body.temperature;
  // Bildgenerierung: Gemini muss ausdrücklich Bilder zurückgeben dürfen.
  if (Array.isArray(body.modalities) && body.modalities.includes("image")) gen.responseModalities = ["TEXT", "IMAGE"];

  // Schwierige Aufgaben: das Modell gründlich nachdenken lassen (wird bei „unbekannt“ automatisch ohne wiederholt).
  const eff = String(body.reasoning_effort ?? body.reasoning?.effort ?? "");
  if (eff === "high" || eff === "medium" || tierOf(body.model) === "strong") gen.thinkingConfig = { thinkingLevel: eff === "medium" ? "medium" : "high" };

  const out: Record<string, unknown> = { contents };
  if (systemTexts.length) out.systemInstruction = { parts: [{ text: systemTexts.join("\n\n") }] };
  if (Object.keys(gen).length) out.generationConfig = gen;
  return out;
}

async function googleFetch(model: string, stream: boolean, payload: any, key: string, signal?: AbortSignal) {
  const url = `${GOOGLE_BASE}/${model}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}`;
  const send = (p: unknown) => fetch(url, { method: "POST", signal, headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(p) });
  const r = await send(payload);
  // Modell kennt die Denk-Einstellung nicht -> gleiche Anfrage ohne.
  if (r.status === 400 && payload?.generationConfig?.thinkingConfig) {
    await r.body?.cancel().catch(() => {});
    const { thinkingConfig: _t, ...gen } = payload.generationConfig;
    return await send({ ...payload, generationConfig: gen });
  }
  return r;
}

/** Wie stark muss das Modell sein? Aus dem gewünschten Modellnamen abgeleitet. */
export function tierOf(model: unknown): Tier {
  const m = String(model || "").toLowerCase();
  if (/lite|nano|luna|[-_]mini|terra/.test(m)) return "fast";
  if (/pro|ultra|sol|opus|gpt-5\.5|gpt-5\.4|gpt-6/.test(m)) return "strong";
  return "mid";
}

/** Mehrere Anbieter gestaffelt starten: der erste zuerst; antwortet er nicht schnell genug (oder scheitert),
 *  startet der nächste dazu. Die erste gute Antwort gewinnt, der Rest wird abgebrochen. */
async function staggered(cands: Array<(signal: AbortSignal) => Promise<Response | null>>, delayMs: number): Promise<Response | null> {
  return await new Promise((resolve) => {
    const ctls = cands.map(() => new AbortController());
    let started = 0, finished = 0, done = false, lastBad: Response | null = null;
    const timers: number[] = [];
    const finish = (r: Response | null, winner: number) => {
      if (done) return; done = true;
      timers.forEach((t) => clearTimeout(t));
      ctls.forEach((c, i) => { if (i !== winner) c.abort(); });
      resolve(r);
    };
    const start = () => {
      if (done || started >= cands.length) return;
      const i = started++;
      if (started < cands.length) timers.push(setTimeout(start, delayMs) as unknown as number);
      cands[i](ctls[i].signal).then((r) => {
        if (done) { r?.body?.cancel().catch(() => {}); return; }
        if (r && r.ok) return finish(r, i);
        if (r) lastBad = r;
        finished++;
        if (finished >= cands.length) finish(lastBad, -1); else start();
      }).catch(() => { finished++; if (finished >= cands.length) finish(lastBad, -1); else start(); });
    };
    start();
  });
}

/** Google-SSE -> OpenAI-kompatibler SSE-Stream */
function googleSseToOpenAi(src: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const dec = new TextDecoder();
  let buf = "";
  return new ReadableStream({
    async start(c) {
      const reader = src.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith("data:")) continue;
            const raw = t.slice(5).trim();
            if (!raw || raw === "[DONE]") continue;
            try {
              const j = JSON.parse(raw);
              const parts = j.candidates?.[0]?.content?.parts ?? [];
              const text = parts.filter((p: any) => !p.thought).map((p: any) => p.text || "").join("");
              if (text) c.enqueue(sse({ choices: [{ delta: { content: text } }] }));
              const usage = geminiUsageToOpenAi(j.usageMetadata);
              if (usage) c.enqueue(sse({ choices: [], usage }));
            } catch (_e) { /* ignore partial */ }
          }
        }
      } catch (e) {
        console.error("[gemini-fallback] stream error", e);
      }
      c.enqueue(sseDone());
      c.close();
    },
  });
}

let gatewayEmptyUntil = 0;

function shouldFallback(status: number) {
  return status === 402 || status === 429 || status === 401 || status === 403 || status >= 500;
}

/**
 * Ruft das Lovable Gateway auf und fällt bei Credit-/Limit-/Serverfehlern
 * automatisch auf Google Gemini zurück. Antwort ist immer OpenAI-kompatibel.
 */
/** Lovable-Key nur, wenn wirklich einer da ist (eigenes Supabase hat keinen -> direkt Google). */
export function lovableKeyOrNull(k?: string | null): string | undefined {
  const v = (k ?? "").trim();
  return v && v !== "undefined" && v !== "null" && v.length > 10 ? v : undefined;
}

const googleCooldown = new Map<string, number>();

export async function aiChat(
  body: Record<string, any>,
  lovableKey?: string,
): Promise<Response> {
  // Interner Hinweis (nie an Anbieter weitergeben): diese Anfrage braucht das stärkste Modell, z. B. Dateien/Code.
  const hint = body.mythos_tier === "strong" ? "strong" as Tier : null;
  // "alt": bewusst die andere Modell-Familie fragen (zweite Meinung / Gegenprüfung).
  const alt = body.mythos_route === "alt";
  const maxHint = Number(body.mythos_max_tokens) || 0;
  if ("mythos_tier" in body || "mythos_route" in body || "mythos_max_tokens" in body) { body = { ...body }; delete body.mythos_tier; delete body.mythos_route; delete body.mythos_max_tokens; }
  const streaming = body.stream === true;
  const key = lovableKeyOrNull(lovableKey) ?? lovableKeyOrNull(Deno.env.get("LOVABLE_API_KEY"));

  const skippedGateway = !!key && Date.now() <= gatewayEmptyUntil;
  if (key && !skippedGateway && !(alt && nvidiaCanHandle(body) && (await nvidiaKeys()).length > 0)) {
    try {
      const r = await fetch(GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) return r;
      const info = await r.text().catch(() => "");
      console.warn("[ai] gateway failed", r.status, info.slice(0, 200));
      // Guthaben leer: ein paar Minuten direkt zu Google, statt jedes Mal erst am Gateway abzuprallen.
      if (r.status === 402) gatewayEmptyUntil = Date.now() + 5 * 60_000;
      if (!shouldFallback(r.status)) {
        return new Response(info, { status: r.status, headers: { "Content-Type": "application/json" } });
      }
    } catch (e) {
      console.warn("[ai] gateway exception", e instanceof Error ? e.message : String(e));
    }
  }

  // ---- Ohne Gateway: Google AI Studio und NVIDIA zusammen ----
  // Starke Aufgaben und alles mit Werkzeugen zuerst an die großen NVIDIA-Modelle (Google kann im
  // Gratis-Tarif nur Flash und in diesem Weg keine Werkzeuge); der Rest zuerst an Gemini Flash.
  // Antwortet der erste nicht zügig oder ist ausgelastet, springt automatisch der andere ein.
  if (maxHint && body.max_tokens == null && body.max_completion_tokens == null) body = { ...body, max_tokens: maxHint };
  const tier = hint ?? tierOf(body.model);
  // Hochgestufte Anfrage: auch bei Google die stärkste Kette und gründliches Nachdenken.
  const gBody = hint && tierOf(body.model) !== "strong" ? { ...body, model: "google/gemini-pro", reasoning_effort: body.reasoning_effort ?? "high" } : body;
  const hasTools = Array.isArray(body.tools) && body.tools.length > 0;
  const nvReady = nvidiaCanHandle(body) && (await nvidiaKeys()).length > 0;
  let resp: Response | null;
  if (!nvReady) resp = await googleChat(gBody);
  else {
    const g = (_s: AbortSignal) => googleChat(gBody);
    const n = (s: AbortSignal) => nvidiaChat(body, tier, { signal: s, skip: alt ? 1 : 0 });
    const nvFirst = tier === "strong" || hasTools;
    // Zweite Meinung: ein ANDERES Modell als sonst – bei starken Aufgaben das zweitbeste NVIDIA-Modell, sonst NVIDIA statt Gemini.
    resp = await staggered(nvFirst || alt ? [n, g] : [g, n], streaming ? 9_000 : 45_000);
  }
  if (resp && resp.ok) return resp;

  // Auch das hat nicht geklappt: Gateway doch wieder versuchen (vielleicht wurde Guthaben nachgeladen).
  if (skippedGateway) { gatewayEmptyUntil = 0; return aiChat(hint ? { ...body, mythos_tier: hint } : body, lovableKey); }
  return resp ?? new Response(JSON.stringify({ error: "AI unavailable: kein Anbieter erreichbar" }), { status: 503, headers: { "Content-Type": "application/json" } });
}

/** Direkt zu Google AI Studio (Gemini Flash): mehrere Modelle und Schlüssel, überlastete werden übersprungen. */
async function googleChat(body: Record<string, any>): Promise<Response> {
  const streaming = body.stream === true;
  const keys = await googleKeys();
  const chain = geminiChain(body.model);
  const payload = await toGeminiBody(body);
  let lastStatus = 503;
  let lastText = "no google key configured";

  // Überlastete (503) oder ausgeschöpfte (429) Modell/Key-Paare ein paar Minuten überspringen,
  // statt bei jeder Anfrage erneut sekundenlang daran zu scheitern.
  const now = Date.now();
  const pairs = chain.flatMap(m => keys.map(k => [m, k] as const));
  const fresh = pairs.filter(([m, k]) => (googleCooldown.get(m + k.slice(-6)) ?? 0) <= now);
  const order = fresh.length ? fresh : pairs;
  // Beim Streamen die ersten drei Kandidaten gleichzeitig starten: der erste, der antwortet, gewinnt.
  // Google-Free-Tier ist oft überlastet; nacheinander probieren kostet sonst 20–50 s bis zum ersten Wort.
  if (streaming && order.length > 1) {
    const racers = order.slice(0, 6).map(([m, k]) => {
      const ctrl = new AbortController();
      const p = googleFetch(m, true, payload, k, ctrl.signal).then(r => {
        if (!r.ok || !r.body) {
          if (r.status === 429 || r.status === 503) googleCooldown.set(m + k.slice(-6), Date.now() + (r.status === 429 ? 10 : 2) * 60_000);
          console.warn("[ai] google race failed", m, r.status);
          r.body?.cancel().catch(() => {});
          throw new Error(String(r.status));
        }
        return r;
      });
      return { ctrl, p };
    });
    try {
      const win = await Promise.any(racers.map(x => x.p));
      racers.forEach(x => x.p.then(r => { if (r !== win) { x.ctrl.abort(); } }).catch(() => {}));
      if (!win.body) throw new Error("Empty Google stream");
      return new Response(googleSseToOpenAi(win.body), { headers: { "Content-Type": "text/event-stream" } });
    } catch { /* alle drei gescheitert -> restliche nacheinander */ }
  }
  for (const [gModel, gk] of (streaming && order.length > 1 ? order.slice(6) : order)) {
    {
      try {
        const r = await googleFetch(gModel, streaming, payload, gk);
        if (!r.ok) {
          if (r.status === 429 || r.status === 503) googleCooldown.set(gModel + gk.slice(-6), Date.now() + (r.status === 429 ? 10 : 2) * 60_000);
          lastStatus = r.status;
          lastText = (await r.text().catch(() => "")).slice(0, 300);
          console.warn("[ai] google failed", gModel, r.status, lastText.slice(0, 120));
          continue;
        }
        if (streaming && r.body) {
          return new Response(googleSseToOpenAi(r.body), {
            headers: { "Content-Type": "text/event-stream" },
          });
        }
        const j = await r.json();
        const parts = j.candidates?.[0]?.content?.parts ?? [];
        const text = parts.map((p: any) => p.text || "").join("");
        // Erzeugte Bilder im gleichen Format wie der Lovable-Gateway zurückgeben (message.images).
        const images = parts.filter((p: any) => p.inlineData?.data)
          .map((p: any) => ({ type: "image_url", image_url: { url: `data:${p.inlineData.mimeType || "image/png"};base64,${p.inlineData.data}` } }));
        if (body.modalities?.includes?.("image") && !images.length) {
          lastStatus = 502; lastText = `${gModel}: kein Bild in der Antwort`;
          continue;
        }
        return new Response(
          JSON.stringify({ choices: [{ message: { role: "assistant", content: text, ...(images.length ? { images } : {}) }, finish_reason: "stop" }], usage: geminiUsageToOpenAi(j.usageMetadata) }),
          { headers: { "Content-Type": "application/json" } },
        );
      } catch (e) {
        lastText = e instanceof Error ? e.message : String(e);
        console.warn("[ai] google exception", gModel, lastText);
      }
    }
  }


  return new Response(JSON.stringify({ error: `AI unavailable: ${lastText}` }), {
    status: lastStatus,
    headers: { "Content-Type": "application/json" },
  });
}

/** Bequemer Helper für nicht-streamende Aufrufe: gibt direkt den Text zurück. */
export async function aiText(body: Record<string, any>, lovableKey?: string): Promise<string> {
  const r = await aiChat({ ...body, stream: false }, lovableKey);
  if (!r.ok) return "";
  const j = await r.json().catch(() => null);
  return j?.choices?.[0]?.message?.content ?? "";
}

/**
 * Drop-in-Ersatz für `fetch("https://ai.gateway.lovable.dev/v1/chat/completions", init)`.
 * Gleiche Signatur wie fetch, aber mit automatischem Google-Gemini-Fallback.
 */
export async function aiFetch(_url: string, init: RequestInit): Promise<Response> {
  let body: Record<string, any> = {};
  try { body = JSON.parse(String(init?.body ?? "{}")); } catch { /* ignore */ }
  const h = new Headers(init?.headers as HeadersInit);
  const auth = h.get("Authorization") || "";
  const key = auth.replace(/^Bearer\s+/i, "").trim() || undefined;
  return await aiChat(body, key);
}
