// Videos selbst ansehen: Die KI (Gemini) bekommt das ECHTE Video – Bild für Bild und mit Ton –
// und beschreibt genau, was passiert. Das Ergebnis wird als Text in die Unterhaltung eingesetzt,
// damit jedes Chat-Modell damit weiterarbeiten kann. Der User sieht die Analyse aufklappbar.
//
// Weg 1: Google Files API mit dem Google-AI-Schlüssel (/apikeyadmin) – bis 2 GB, beliebig lang.
// Weg 2 (ohne Google-Schlüssel): Lovable-Gateway mit dem Video als data-URL (nur kleine Videos).
import { googleKeys } from "./ai.ts";

const UPLOAD = "https://generativelanguage.googleapis.com/upload/v1beta/files";
const API = "https://generativelanguage.googleapis.com/v1beta";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODELS = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-2.5-flash"];

export type VideoPart = { type: "video_url"; video_url: { url: string; name?: string; mime?: string } };

const PROMPT = (name: string) =>
  `Du bist die Augen und Ohren von Mythos AI. Schau dir das Video „${name}“ KOMPLETT und genau an – Bild für Bild, mit Ton.\n` +
  "Liefere eine sachliche, sehr genaue Analyse auf Deutsch:\n" +
  "1. **Überblick** (2–3 Sätze): Was ist das für ein Video, Länge, Stil (echt, Animation, Screen-Recording, Spiel …).\n" +
  "2. **Ablauf mit Zeitstempeln** (m:ss): jede Szene/Bewegung/Veränderung in der Reihenfolge, wie sie passiert. Bei Bewegungen (z. B. Rückwärtssalto, Laufen) die einzelnen Phasen genau beschreiben: Ausgangshaltung, Absprung, Drehung, Landung, Körperhaltung, Arme/Beine.\n" +
  "3. **Details**: Personen/Figuren, Kleidung, Farben, Umgebung, Kamera (Winkel, Schnitte, Zoom), Texte im Bild (wörtlich), UI-Elemente.\n" +
  "4. **Ton**: Sprache (wörtlich, soweit verständlich), Musik, Geräusche – oder „kein Ton“.\n" +
  "5. **Auffälligkeiten**: Fehler, Ruckler, Besonderheiten.\n" +
  "Erfinde nichts. Wenn etwas unklar ist, sag es.";

function b64(buf: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function viaGoogle(bytes: Uint8Array, mime: string, name: string, key: string, log: (s: string) => void): Promise<string> {
  // 1) Hochladen (resumable, ein Stück)
  const start = await fetch(UPLOAD, {
    method: "POST",
    headers: {
      "x-goog-api-key": key, "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.length), "X-Goog-Upload-Header-Content-Type": mime, "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: name.slice(0, 100) } }),
  });
  const upUrl = start.headers.get("x-goog-upload-url");
  if (!start.ok || !upUrl) throw new Error(`Upload-Start fehlgeschlagen (${start.status})`);
  const up = await fetch(upUrl, { method: "POST", headers: { "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize", "Content-Length": String(bytes.length) }, body: bytes });
  if (!up.ok) throw new Error(`Upload fehlgeschlagen (${up.status})`);
  let file = (await up.json()).file as { name: string; uri: string; state: string; mimeType?: string };
  // 2) Warten, bis Google das Video verarbeitet hat
  log("Video wird von der KI eingelesen …");
  for (let i = 0; i < 60 && file.state === "PROCESSING"; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const r = await fetch(`${API}/${file.name}`, { headers: { "x-goog-api-key": key } });
    if (r.ok) file = await r.json();
  }
  if (file.state !== "ACTIVE") throw new Error("Video konnte nicht verarbeitet werden (" + file.state + ")");
  // 3) Ansehen lassen – mehrere Bilder pro Sekunde, damit schnelle Bewegungen nicht fehlen
  log("Mythos schaut das Video an …");
  let last = "";
  for (const model of MODELS) {
    const r = await fetch(`${API}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ fileData: { mimeType: file.mimeType || mime, fileUri: file.uri }, videoMetadata: { fps: 5 } }, { text: PROMPT(name) }] }],
        generationConfig: { maxOutputTokens: 6000, temperature: 0.2 },
      }),
    });
    if (!r.ok) { last = `${model}: ${r.status}`; continue; }
    const j = await r.json();
    const text = (j.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || "").join("").trim();
    // Datei wieder löschen (nicht abwarten)
    fetch(`${API}/${file.name}`, { method: "DELETE", headers: { "x-goog-api-key": key } }).catch(() => {});
    if (text) return text;
  }
  throw new Error("Kein Modell konnte das Video ansehen (" + last + ")");
}

async function viaGateway(bytes: Uint8Array, mime: string, name: string, lovableKey: string): Promise<string> {
  if (bytes.length > 15_000_000) throw new Error("Video zu groß ohne Google-AI-Schlüssel (max. 15 MB) – Admin: /apikeyadmin AIza…");
  const r = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      messages: [{ role: "user", content: [{ type: "text", text: PROMPT(name) }, { type: "image_url", image_url: { url: `data:${mime};base64,${b64(bytes)}` } }] }],
      max_tokens: 6000,
    }),
  });
  if (!r.ok) throw new Error(`KI konnte das Video nicht ansehen (${r.status})`);
  const j = await r.json();
  const text = String(j.choices?.[0]?.message?.content || "").trim();
  if (!text) throw new Error("Leere Video-Analyse");
  return text;
}

/** Video ansehen lassen → Analyse-Text. log() meldet Fortschritt an den Chat. */
export async function watchVideo(part: VideoPart, lovableKey: string | undefined, log: (s: string) => void): Promise<string> {
  const { url } = part.video_url;
  const name = part.video_url.name || url.split("/").pop()?.split("?")[0] || "video";
  if (!/^https:\/\//i.test(url)) throw new Error("Video-Adresse ungültig");
  log("Video wird geladen …");
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Video nicht erreichbar (${res.status})`);
  const mime = part.video_url.mime || (res.headers.get("content-type") || "video/mp4").split(";")[0];
  const bytes = new Uint8Array(await res.arrayBuffer());
  return await watchVideoBytes(bytes, mime, name, lovableKey, log);
}

/** Video-Bytes direkt ansehen lassen (z. B. aus der Code-App hochgeladen). */
export async function watchVideoBytes(bytes: Uint8Array, mime: string, name: string, lovableKey: string | undefined, log: (s: string) => void = () => {}): Promise<string> {
  if (bytes.length > 200_000_000) throw new Error("Video zu groß (max. 200 MB)");
  const keys = await googleKeys();
  let lastErr: unknown = null;
  for (const k of keys) {
    try { return await viaGoogle(bytes, mime, name, k, log); } catch (e) { lastErr = e; console.warn("[video] google", e instanceof Error ? e.message : e); }
  }
  if (lovableKey) return await viaGateway(bytes, mime, name, lovableKey);
  throw lastErr instanceof Error ? lastErr : new Error("Kein KI-Zugang für Videos – Admin: /apikeyadmin AIza…");
}

/** Alle video_url-Teile in den Nachrichten durch die Analyse ersetzen (nur die letzte User-Nachricht wird angesehen). */
export async function prepareVideos(
  messages: { role: string; content: unknown }[],
  lovableKey: string | undefined,
  emit: (ev: Record<string, unknown>) => void,
): Promise<void> {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  for (const m of messages) {
    if (!Array.isArray(m.content)) continue;
    const parts = m.content as Record<string, unknown>[];
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i] as VideoPart;
      if (p?.type !== "video_url") continue;
      const name = p.video_url?.name || "Video";
      if (m !== lastUser) { parts[i] = { type: "text", text: `[Video „${name}“ wurde früher im Chat angesehen]` }; continue; }
      emit({ tool: `🎬 Schaue Video an: ${name}` });
      try {
        const analysis = await watchVideo(p, lovableKey, () => {});
        // Analyse als eigenes Ereignis: im Chat aufklappbar unter „Video angesehen“.
        emit({ videoAnalysis: { name, text: analysis } });
        parts[i] = { type: "text", text: `\n## Video „${name}“ – du hast es dir gerade selbst komplett angesehen (Bild und Ton). Deine Beobachtungen:\n${analysis}\n\nBeziehe dich in deiner Antwort darauf wie jemand, der das Video gesehen hat (mit Zeitstempeln). Sag nicht, dass du Videos nicht ansehen kannst.` };
      } catch (e) {
        const why = e instanceof Error ? e.message : String(e);
        emit({ tool: `⚠ Video konnte nicht angesehen werden: ${why}` });
        parts[i] = { type: "text", text: `\n[Video „${name}“ konnte gerade nicht angesehen werden: ${why}. Sag das dem User kurz und ehrlich.]` };
      }
    }
  }
}
