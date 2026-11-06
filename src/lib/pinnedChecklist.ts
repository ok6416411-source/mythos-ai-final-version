// Angeheftete Checkliste: Mythos schickt Pläne als ```mythos-ui {"type":"checklist","id":…}.
// Statt jede Version im Verlauf zu zeigen, heftet der Chat die NEUESTE unten über dem Eingabefeld an.
// Was der User selbst abhakt, wird pro Chat gespeichert und Mythos bei jeder Nachricht mitgeteilt.

export type PinItem = { text: string; done: boolean };
export type PinnedChecklist = { id: string; title: string; items: PinItem[] };

const UI_BLOCK = /```mythos-ui[^\n]*\n([\s\S]*?)```/g;

function parseLoose(t: string): unknown {
  try { return JSON.parse(t); } catch { /* weiter */ }
  try { return JSON.parse(t.replace(/^\s*\/\/.*$/gm, "").replace(/,\s*([}\]])/g, "$1")); } catch { return null; }
}

function checklistsIn(spec: unknown): Record<string, unknown>[] {
  if (!spec || typeof spec !== "object") return [];
  const s = spec as Record<string, unknown>;
  const list = Array.isArray(spec) ? spec : Array.isArray(s.blocks) ? s.blocks : [spec];
  return (list as Record<string, unknown>[]).filter((b) => b && /^(checklist|todo)$/i.test(String(b.type || "")));
}

const norm = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();

/** Neueste Checkliste aus den Assistent-Nachrichten (null, wenn es keine gibt). */
export function latestChecklist(messages: { role: string; content: string }[]): PinnedChecklist | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant" || !m.content?.includes("mythos-ui")) continue;
    const found: Record<string, unknown>[] = [];
    for (const match of m.content.matchAll(UI_BLOCK)) found.push(...checklistsIn(parseLoose(match[1])));
    const last = found[found.length - 1];
    if (!last) continue;
    const items = (Array.isArray(last.items) ? last.items : [])
      .map((it: unknown) => {
        if (typeof it === "string") return { text: it, done: false };
        const o = (it || {}) as { text?: unknown; title?: unknown; done?: unknown };
        return { text: String(o.text || o.title || ""), done: !!o.done };
      })
      .filter((it: PinItem) => it.text);
    if (!items.length) continue;
    const title = String(last.title || "Checkliste");
    return { id: String(last.id || norm(title)), title, items };
  }
  return null;
}

const key = (convId: string, listId: string) => `mythos.pin:${convId}:${listId}`;

/** Vom User abgehakte/aufgehobene Punkte (Text → erledigt). */
export function readUserChecks(convId: string, listId: string): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(key(convId, listId)) || "{}") || {}; } catch { return {}; }
}
export function writeUserChecks(convId: string, listId: string, v: Record<string, boolean>) {
  try { localStorage.setItem(key(convId, listId), JSON.stringify(v)); } catch { /* egal */ }
}

/** Stand = Angabe von Mythos, überschrieben durch das, was der User selbst geklickt hat. */
export function mergedItems(list: PinnedChecklist, user: Record<string, boolean>): PinItem[] {
  return list.items.map((it) => ({ text: it.text, done: user[norm(it.text)] ?? it.done }));
}
export const itemKey = norm;

/** Text für Mythos: aktueller Stand der angehefteten Checkliste. */
export function checklistStatusPrompt(list: PinnedChecklist | null, convId: string | null): string {
  if (!list) return "";
  const items = convId ? mergedItems(list, readUserChecks(convId, list.id)) : list.items;
  const open = items.filter((i) => !i.done).length;
  return `## Oberflächen-Status (live aus dem Chat)\nAngeheftete Checkliste „${list.title}“ (id: ${list.id}) – ${items.length - open} von ${items.length} erledigt:\n` +
    items.map((i) => `${i.done ? "✓" : "☐"} ${i.text}`).join("\n") +
    "\nHäkchen, die der User selbst gesetzt hat, sind schon eingerechnet. Wenn du Punkte erledigst, schick dieselbe Liste (gleiche id) mit \"done\": true neu. Sind alle erledigt, erwähne die Liste nicht mehr.";
}
