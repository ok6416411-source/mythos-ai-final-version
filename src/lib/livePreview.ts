import { splitFiles, prepareFile } from "@/lib/chatFileParts";

export type PreviewItem = { key: string; name: string; content: string; kind: "html" | "svg" | "bbmodel" };

/** Neuestes vorschaufähiges Ergebnis im Chat finden (Datei-Blöcke oder ```html-Codeblöcke). Halbe Dateien nie. */
export function latestPreview(messages: { role: string; content: string }[]): PreviewItem | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant" || typeof m.content !== "string") continue;
    const { files } = splitFiles(m.content);
    for (let k = files.length - 1; k >= 0; k--) {
      const f = files[k]; if (f.base64) continue;
      if (/\.html?$/i.test(f.name)) return { key: i + ":" + f.name + f.content.length, name: f.name, content: f.content, kind: "html" };
      if (/\.svg$/i.test(f.name)) return { key: i + ":" + f.name + f.content.length, name: f.name, content: f.content, kind: "svg" };
      if (/\.bbmodel$/i.test(f.name)) { const p = prepareFile(f.name, f.content, false); if (p.blob) return { key: i + ":" + f.name + p.content.length, name: f.name, content: p.content, kind: "bbmodel" }; }
    }
    const blocks = [...m.content.matchAll(/```(html|svg)\s*\n([\s\S]*?)\n```/gi)];
    const b = blocks.pop();
    if (b && b[2].length > 80 && /<(html|body|svg|canvas|div|script)/i.test(b[2])) {
      const svg = b[1].toLowerCase() === "svg" || /^\s*<svg/i.test(b[2]);
      return { key: i + ":block" + b[2].length, name: svg ? "grafik.svg" : "vorschau.html", content: b[2], kind: svg ? "svg" : "html" };
    }
  }
  return null;
}
