// Datei-Blöcke aus Mythos-Antworten herauslösen und für Download/Vorschau vorbereiten.
// Gemeinsam genutzt von Chat-Nachricht, „Dateien“-Liste und Artifacts.
import { extOf, fileBlob, parseFileInfo } from "@/lib/chatFiles";
import { finishBBModel } from "@/lib/bbmodel";

/** Datei-Blöcke (```datei:…) aus der Antwort lösen: Sie erscheinen gesammelt als Karten am Ende.
 *  Ein noch offener Block (Antwort läuft noch) wird als „wird geschrieben“ angezeigt, nie als halbe Datei. */
export function splitFiles(md: string) {
  const files: { name: string; content: string; base64: boolean }[] = [];
  let writing: { name: string; lines: number } | null = null;
  const out: string[] = [];
  const lines = md.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const open = /^\s*```([^`\n]*)$/.exec(lines[i]);
    const file = open ? parseFileInfo(open[1]) : null;
    if (!open || !file) {
      out.push(lines[i]);
      // normalen Codeblock komplett übernehmen (darin keine Datei-Erkennung)
      if (open) { while (++i < lines.length) { out.push(lines[i]); if (/^\s*```\s*$/.test(lines[i])) break; } }
      continue;
    }
    const body: string[] = [];
    let closed = false;
    while (++i < lines.length) { if (/^\s*```\s*$/.test(lines[i])) { closed = true; break; } body.push(lines[i]); }
    if (closed) files.push({ name: file.name, content: body.join("\n"), base64: file.base64 });
    else writing = { name: file.name, lines: body.length };
  }
  return { text: out.join("\n").replace(/\n{3,}/g, "\n\n").trim(), files, writing };
}

/** .bbmodel: kompakte Würfel-Liste von Mythos → vollständige Blockbench-Datei. */
export function prepareFile(name: string, content: string, base64: boolean): { blob: Blob | null; content: string; note?: string; error?: string } {
  if (extOf(name) === "bbmodel" && !base64) {
    const r = finishBBModel(content);
    if (r.ok === false) return { blob: null, content, error: r.error };
    return { blob: fileBlob(name, r.content, false), content: r.content, note: `${r.cubes} Würfel` };
  }
  try { return { blob: fileBlob(name, content, base64), content }; } catch { return { blob: null, content, error: "Datei ist beschädigt" }; }
}


export type ChatFileItem = { name: string; content: string; base64: boolean; msgIndex: number };

/** Alle fertigen Dateien eines Chats (neueste Version je Dateiname zuletzt). */
export function filesOfChat(messages: { role: string; content: string }[]): ChatFileItem[] {
  const out: ChatFileItem[] = [];
  messages.forEach((m, i) => {
    if (m.role !== "assistant" || !m.content?.includes("```")) return;
    for (const f of splitFiles(m.content).files) out.push({ ...f, msgIndex: i });
  });
  // gleicher Name → nur die neueste behalten
  const seen = new Map<string, ChatFileItem>();
  for (const f of out) seen.set(f.name, f);
  return [...seen.values()];
}
