// Gemeinsame Grafik-Erzeugung für Chat, image-gen (Filmstudio, Code-App /bild), Labs.
// Seit 2026-11: Grafiken werden als SVG gezeichnet (keine Bild-KI mehr) – siehe generateImage unten.
// Reihenfolge: Nano Banana über das Lovable-Gateway (mit Google-Fallback aus ai.ts) -> FLUX.1 über NVIDIA.
// Nur hochwertige Modelle: Pollinations und AI Horde sind bewusst raus (sahen zu schlecht aus).
// Sind die Lovable-Credits aufgebraucht (402), springt die Kette sofort weiter, statt jedes
// Lovable-Modell einzeln durchzuprobieren.
// Daten-URLs werden in den öffentlichen Bucket "chat-uploads" hochgeladen, damit Chats keine
// riesigen base64-Strings speichern und Bilder überall angezeigt werden können.
import { createClient } from "npm:@supabase/supabase-js@2.103.3";
import { aiFetch } from "./ai.ts";

const MODELS = ["google/gemini-2.5-flash-image", "google/gemini-3.1-flash-image-preview"];

function admin() {
  const url = Deno.env.get("SUPABASE_URL"), sr = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return url && sr ? createClient(url, sr) : null;
}

async function storeBytes(bytes: Uint8Array, mime: string): Promise<string | null> {
  const sb = admin();
  if (!sb) return null;
  const ext = mime.includes("svg") ? "svg" : mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
  const path = `generated/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from("chat-uploads").upload(path, bytes, { contentType: mime, upsert: false });
  if (error) { console.warn("[image] upload failed", error.message); return null; }
  return sb.storage.from("chat-uploads").getPublicUrl(path).data.publicUrl;
}

async function storeDataUrl(url: string): Promise<string> {
  const m = url.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return url;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return (await storeBytes(bytes, m[1])) ?? url;
}

async function viaGateway(prompt: string, lovableKey: string | undefined, errors: string[]): Promise<string | null> {
  for (const model of MODELS) {
    try {
      const r = await aiFetch("gateway", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [{ role: "user", content: `Generate a high quality image: ${prompt}` }], modalities: ["image", "text"] }),
      });
      if (!r.ok) {
        const info = (await r.text()).slice(0, 160);
        errors.push(`${model}: HTTP ${r.status} ${info}`);
        // Credits leer / kein Google-Schlüssel: das zweite Modell scheitert genauso -> direkt zum Backup.
        if (r.status === 402 || r.status === 429 || /no google key|quota|credits/i.test(info)) break;
        continue;
      }
      const j = await r.json();
      const url = j.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (url) return url;
      errors.push(`${model}: kein Bild`);
    } catch (e) { errors.push(`${model}: ${e instanceof Error ? e.message : String(e)}`); }
  }
  return null;
}

async function nvidiaKey(): Promise<string> {
  const env = Deno.env.get("NVIDIA_IMAGE_API_KEY") || Deno.env.get("NVIDIA_API_KEY") || "";
  if (env) return env;
  try {
    const { data } = await admin()!.from("app_secrets").select("name, value").in("name", ["NVIDIA_IMAGE_API_KEY", "NVIDIA_API_KEY"]);
    const s: Record<string, string> = {}; for (const r of data ?? []) s[r.name] = r.value;
    return s.NVIDIA_IMAGE_API_KEY || s.NVIDIA_API_KEY || "";
  } catch { return ""; /* Tabelle fehlt -> kein NVIDIA */ }
}

// NVIDIA-Bildmodelle (build.nvidia.com, Gratis-Credits). Antwort: { artifacts: [{ base64 }] } oder { image }.
const NVIDIA_MODELS: { name: string; path: string; body: (p: string) => Record<string, unknown> }[] = [
  { name: "flux.1-dev", path: "black-forest-labs/flux.1-dev", body: (prompt) => ({ prompt, mode: "base", cfg_scale: 3.5, width: 1024, height: 1024, seed: 0, steps: 50 }) },
  { name: "flux.1-schnell", path: "black-forest-labs/flux.1-schnell", body: (prompt) => ({ prompt, width: 1024, height: 1024, seed: 0, steps: 4 }) },
  { name: "sd3.5-large", path: "stabilityai/stable-diffusion-3-5-large", body: (prompt) => ({ prompt, cfg_scale: 5, aspect_ratio: "1:1", seed: 0, steps: 40, negative_prompt: "" }) },
];

async function viaNvidia(prompt: string, errors: string[]): Promise<string | null> {
  const key = await nvidiaKey();
  if (!key) { errors.push("nvidia: kein Schlüssel hinterlegt (/nvidiakeyadmin bild nvapi-…)"); return null; }
  for (const m of NVIDIA_MODELS) {
    try {
      const r = await fetch(`https://ai.api.nvidia.com/v1/genai/${m.path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ ...m.body(prompt.slice(0, 2000)), seed: Math.floor(Math.random() * 1e9) }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!r.ok) {
        errors.push(`nvidia: ${m.name} HTTP ${r.status}`);
        if (r.status === 401 || r.status === 403) return null; // Schlüssel ungültig -> andere Modelle scheitern genauso
        continue;
      }
      const j = await r.json();
      const b64 = j.artifacts?.[0]?.base64 ?? j.image ?? j.data?.[0]?.b64_json;
      if (j.artifacts?.[0]?.finishReason === "CONTENT_FILTERED") { errors.push(`nvidia: ${m.name} Inhalt gefiltert`); continue; }
      if (b64) return `data:image/${j.artifacts ? "jpeg" : "png"};base64,${b64}`;
      errors.push(`nvidia: ${m.name} kein Bild`);
    } catch (e) { errors.push(`nvidia: ${m.name} ${e instanceof Error ? e.message : String(e)}`); }
  }
  return null;
}

export type ImageProvider = "nano-banana" | "nvidia" | "svg";
export const PROVIDER_LABEL: Record<ImageProvider, string> = {
  svg: "Mythos Grafik (SVG)",
  "nano-banana": "Nano Banana",
  nvidia: "FLUX.1 (NVIDIA)",
};

/** Kurze Gründe pro Anbieter (eine Zeile je Anbieter) für die Fehlermeldung im Chat. */
export function explainErrors(error: string | undefined): string[] {
  const seen = new Map<string, string>();
  for (const raw of (error || "").split(" | ")) {
    const m = raw.match(/^([^:]+):\s*(.*)$/);
    if (!m) continue;
    const name = /gemini|google/i.test(m[1]) ? "Lovable/Google" : m[1][0].toUpperCase() + m[1].slice(1);
    const why = m[2].replace(/\{"error":"?|"?\}$/g, "").replace(/AI unavailable:\s*/i, "").replace(/no google key configured/i, "Credits leer und kein GOOGLE_AI_API_KEY").slice(0, 110);
    seen.set(name, why);
  }
  return [...seen].map(([k, v]) => `${k}: ${v}`);
}

/** Erzeugt ein Bild und liefert eine anzeigbare URL (möglichst https aus dem Storage). */
// Keine Bild-KI mehr: Mythos ZEICHNET Grafiken selbst als SVG (wie Claude) – scharf in jeder Größe,
// bearbeitbar, ohne Bildgenerator. Alle Stellen, die bisher Bilder erzeugt haben (Chat, Filmstudio,
// Code-App, Labs), bekommen über diese Funktion automatisch eine SVG-Grafik.
const SVG_PROMPT = (prompt: string) =>
  "Zeichne diese Grafik als EIN vollständiges, eigenständiges SVG (viewBox=\"0 0 1024 1024\" oder passendes Seitenverhältnis, z. B. 1920x1080 für Szenen).\n" +
  "Qualität wie ein guter Illustrator: klare Komposition, harmonische Farbpalette, Verläufe (linearGradient/radialGradient), weiche Schatten (filter mit feGaussianBlur), " +
  "Details und Tiefe (Vorder-/Mittel-/Hintergrund), saubere Formen mit path. Kein Text im Bild, außer er ist ausdrücklich gewünscht. Keine externen Bilder, Fonts oder Skripte.\n" +
  "Antworte NUR mit dem SVG-Code (<svg …>…</svg>), ohne Erklärung, ohne Markdown.\n\nMotiv: " + prompt;

export async function generateSvg(prompt: string, lovableKey?: string): Promise<string | null> {
  lovableKey = lovableKey ?? Deno.env.get("LOVABLE_API_KEY");
  for (const model of ["google/gemini-3.1-pro-preview", "google/gemini-3.6-flash"]) {
    try {
      const r = await aiFetch("gateway", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [{ role: "user", content: SVG_PROMPT(prompt) }], max_tokens: 16000 }),
      });
      if (!r.ok) continue;
      const text = String((await r.json()).choices?.[0]?.message?.content || "");
      const svg = text.match(/<svg[\s\S]*<\/svg>/i)?.[0];
      if (svg && svg.length > 200) return svg.replace(/<script[\s\S]*?<\/script>/gi, "");
    } catch { /* nächstes Modell */ }
  }
  return null;
}

export async function generateImage(
  prompt: string,
  lovableKey?: string,
  _opts: { browserFallback?: boolean } = {},
): Promise<{ url: string | null; provider?: ImageProvider; error?: string; svg?: string }> {
  const svg = await generateSvg(prompt, lovableKey);
  if (!svg) return { url: null, error: "Grafik konnte nicht gezeichnet werden" };
  const bytes = new TextEncoder().encode(svg);
  const url = (await storeBytes(bytes, "image/svg+xml")) ?? `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  return { url, provider: "svg", svg };
}
