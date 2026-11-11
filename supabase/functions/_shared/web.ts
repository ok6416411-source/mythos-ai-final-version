// Kleine Internet-Recherche für Server-Funktionen: suchen (DuckDuckGo-HTML) und Seiten als Text lesen.
export type WebHit = { url: string; title: string; snippet: string };

const UA = { "User-Agent": "Mozilla/5.0 (compatible; MythosAI/1.0)", "Accept-Language": "de,en;q=0.8" };
const decode = (s: string) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/** Nur öffentliche Web-Adressen – keine internen Netze. */
export function safeUrl(u: string): string | null {
  try {
    const url = new URL(u);
    if (!/^https?:$/.test(url.protocol)) return null;
    const h = url.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h.includes(":") ) return null;
    return url.toString();
  } catch { return null; }
}

export async function webSearch(query: string, max = 5): Promise<WebHit[]> {
  try {
    const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, { headers: UA, signal: AbortSignal.timeout(12000) });
    const html = await r.text();
    const out: WebHit[] = [];
    const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null && out.length < max) {
      let url = decode(m[1]);
      const uddg = /[?&]uddg=([^&]+)/.exec(url);           // DuckDuckGo leitet über eine eigene Adresse um
      if (uddg) url = decodeURIComponent(uddg[1]);
      if (url.startsWith("//")) url = "https:" + url;
      const ok = safeUrl(url); if (!ok) continue;
      out.push({ url: ok, title: decode(m[2].replace(/<[^>]+>/g, "")).trim(), snippet: decode(m[3].replace(/<[^>]+>/g, "")).trim() });
    }
    return out;
  } catch { return []; }
}

/** Seite laden und als reinen Text zurückgeben (plus gefundene Bild-Adressen, falls gewünscht). */
export async function readPage(url: string, maxChars = 6000): Promise<{ url: string; title: string; text: string; images: string[] } | null> {
  const ok = safeUrl(url); if (!ok) return null;
  try {
    const r = await fetch(ok, { headers: UA, signal: AbortSignal.timeout(12000), redirect: "follow" });
    if (!r.ok || !/html|text|json|xml/i.test(r.headers.get("content-type") || "html")) return null;
    const html = (await r.text()).slice(0, 600_000);
    const title = decode((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || "").replace(/\s+/g, " ")).trim().slice(0, 140);
    const images: string[] = [];
    for (const m of html.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']|<img[^>]+src=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["']/gi)) {
      try { const u = safeUrl(new URL(decode(m[1] || m[2]), ok).toString()); if (u && !images.includes(u) && images.length < 8) images.push(u); } catch { /* egal */ }
    }
    const text = decode(html.replace(/<(script|style|noscript|svg|nav|footer)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    return { url: ok, title, text: text.slice(0, maxChars), images };
  } catch { return null; }
}

export type Media = { type: "image" | "video"; url: string; title: string; width?: number; height?: number; thumb?: string; source: string; page?: string };

/** Freie Fotos/Videos zum Thema von Wikimedia Commons (kein Schlüssel nötig). Suchbegriffe am besten englisch. */
export async function commonsMedia(query: string, type: "image" | "video", max = 6): Promise<Media[]> {
  try {
    const q = `${query} filetype:${type === "video" ? "video" : "bitmap"}`;
    const api = "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=" + (max * 3) +
      "&gsrsearch=" + encodeURIComponent(q) + "&prop=imageinfo|videoinfo&iiprop=url|mime|size&iiurlwidth=1280&viprop=url|mime|size|derivatives";
    const r = await fetch(api, { headers: UA, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return [];
    const pages = Object.values(((await r.json())?.query?.pages ?? {}) as Record<string, any>).sort((a: any, b: any) => (a.index ?? 0) - (b.index ?? 0));
    const out: Media[] = [];
    for (const p of pages) {
      const title = String(p.title || "").replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " ");
      if (type === "video") {
        const v = p.videoinfo?.[0]; if (!v) continue;
        // Kleinere, überall abspielbare Fassung bevorzugen (720p/480p), nicht das riesige Original.
        const ders = (v.derivatives || []).filter((d: any) => /video\/(webm|mp4)/.test(String(d.type || "")) && d.src);
        const pick = ders.find((d: any) => /720p/.test(d.src)) || ders.find((d: any) => /480p/.test(d.src)) || ders[0];
        const url = pick?.src || v.url;
        // Keine langen Filme, keine historischen Stummfilme, nichts Winziges – gesucht sind kurze, ansehnliche Clips.
        if (!url || !v.duration || v.duration < 3 || v.duration > 180 || (v.width || 0) < 640 || /\((18|19)\d\d\)/.test(String(p.title))) continue;
        out.push({ type, url: url.startsWith("//") ? "https:" + url : url, title, width: v.width, height: v.height, thumb: v.thumburl, source: "Wikimedia Commons", page: v.descriptionurl });
      } else {
        const i = p.imageinfo?.[0]; if (!i || !/image\/(jpeg|png|webp)/.test(i.mime || "") || (i.width || 0) < 600) continue;
        out.push({ type, url: i.thumburl || i.url, title, width: i.thumbwidth || i.width, height: i.thumbheight || i.height, thumb: i.thumburl, source: "Wikimedia Commons", page: i.descriptionurl });
      }
      if (out.length >= max) break;
    }
    return out;
  } catch { return []; }
}

/** Stock-Fotos/-Videos von Pexels (nur wenn ein PEXELS_API_KEY hinterlegt ist; liefert MP4, läuft überall). */
export async function pexelsMedia(query: string, type: "image" | "video", key: string, max = 6): Promise<Media[]> {
  try {
    const url = type === "video" ? `https://api.pexels.com/videos/search?per_page=${max}&orientation=landscape&query=${encodeURIComponent(query)}` : `https://api.pexels.com/v1/search?per_page=${max}&query=${encodeURIComponent(query)}`;
    const r = await fetch(url, { headers: { Authorization: key }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return [];
    const j = await r.json();
    if (type === "video") return (j.videos || []).map((v: any) => {
      const f = (v.video_files || []).filter((x: any) => x.file_type === "video/mp4").sort((a: any, b: any) => Math.abs((a.height || 0) - 720) - Math.abs((b.height || 0) - 720))[0];
      return f ? { type, url: f.link, title: String(v.url || "").split("/").filter(Boolean).pop()?.replace(/-\d+$/, "").replace(/-/g, " ") || query, width: f.width, height: f.height, thumb: v.image, source: "Pexels", page: v.url } : null;
    }).filter(Boolean) as Media[];
    return (j.photos || []).map((p: any) => ({ type, url: p.src?.large2x || p.src?.large, title: p.alt || query, width: p.width, height: p.height, thumb: p.src?.medium, source: "Pexels", page: p.url }));
  } catch { return []; }
}
