// Videos im Chat: Das Video wird im Browser in Einzelbilder zerlegt (gleichmäßig über die ganze Länge),
// die Bilder gehen an Mythos. Kein Server nötig, funktioniert mit jedem Modell, das Bilder sieht.

export type VideoFrame = { url: string; t: number };

/** Wie viele Bilder höchstens: kurze Clips dichter (bis 2 pro Sekunde), lange gleichmäßig verteilt. */
export function framePlan(duration: number, max = 40): number[] {
  if (!Number.isFinite(duration) || duration <= 0) return [0];
  const step = Math.max(0.5, duration / max);
  const out: number[] = [];
  for (let t = Math.min(0.1, duration / 2); t < duration && out.length < max; t += step) out.push(Math.round(t * 100) / 100);
  return out.length ? out : [0];
}

const once = (el: HTMLMediaElement, ev: string, ms = 8000) =>
  new Promise<void>((ok, fail) => {
    const t = setTimeout(() => fail(new Error("Zeitüberschreitung beim Lesen des Videos")), ms);
    el.addEventListener(ev, () => { clearTimeout(t); ok(); }, { once: true });
    el.addEventListener("error", () => { clearTimeout(t); fail(new Error("Video kann nicht gelesen werden (Format?)")); }, { once: true });
  });

/** Video → JPEG-Einzelbilder (max. 640 px breit). onProgress(fertig, gesamt) für die Anzeige. */
export async function extractFrames(
  file: Blob,
  onProgress?: (done: number, total: number) => void,
  max = 40,
): Promise<{ frames: { blob: Blob; t: number }[]; duration: number; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
  try {
    await once(v, "loadedmetadata");
    const duration = v.duration;
    const scale = Math.min(1, 640 / (v.videoWidth || 640));
    const w = Math.max(1, Math.round((v.videoWidth || 640) * scale)), h = Math.max(1, Math.round((v.videoHeight || 360) * scale));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d")!;
    const times = framePlan(duration, max);
    const frames: { blob: Blob; t: number }[] = [];
    for (const t of times) {
      v.currentTime = t;
      await once(v, "seeked");
      ctx.drawImage(v, 0, 0, w, h);
      const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.78));
      if (blob) frames.push({ blob, t });
      onProgress?.(frames.length, times.length);
    }
    return { frames, duration, width: v.videoWidth, height: v.videoHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const fmtTime = (t: number) => {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
};

/** Teile für die KI: Hinweis + jedes Bild mit Zeitstempel. */
export function videoPromptParts(name: string, duration: number | undefined, frames: VideoFrame[]) {
  const parts: ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[] = [{
    type: "text",
    text: `\n[Video „${name}“${duration ? `, Länge ${duration.toFixed(1)} s` : ""}: ${frames.length} Einzelbilder, gleichmäßig über das ganze Video verteilt. ` +
      "Schau dir JEDES Bild in zeitlicher Reihenfolge an, beschreibe was passiert (Bewegung, Veränderungen, Text, Personen, Fehler) und nenne bei Aussagen den Zeitpunkt (z. B. 0:04.5). " +
      "Ton/Sprache kannst du nicht hören – sag das, falls es wichtig ist.]",
  }];
  for (const f of frames) {
    parts.push({ type: "text", text: `Bild bei ${fmtTime(f.t)}` });
    parts.push({ type: "image_url", image_url: { url: f.url } });
  }
  return parts;
}
