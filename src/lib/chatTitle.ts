// KI-Chatnamen: Nach der ersten Nachricht und Antwort bekommt ein Chat einen kurzen, passenden Titel
// statt der abgeschnittenen ersten Nachricht. Erst die schlanke suggest-Funktion (kind "title"),
// wenn die live noch alt ist die Chat-Funktion im Instant-Modus, ohne Backend ein lokaler Titel.
import { supabase } from "@/integrations/supabase/client";

const TITLE_SYSTEM = "Du gibst Chats kurze, treffende Titel wie in ChatGPT: 2 bis 5 Wörter, Sprache des Nutzers, " +
  "keine Anführungszeichen, kein Punkt am Ende, keine Emojis, kein „Chat über“. Antworte NUR mit dem Titel.";

/** Titel säubern: erste Zeile, ohne Markdown/Anführungszeichen, max. 60 Zeichen. */
export function cleanTitle(raw: string): string {
  let t = (raw || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim().split("\n").find(l => l.trim()) || "";
  t = t.replace(/^\s*(titel|title)\s*:\s*/i, "").replace(/[*_#`]+/g, "").replace(/^["'„“”«»\s]+|["'„“”«»\s]+$/g, "").replace(/[.。!]+$/, "").trim();
  return t.length > 60 ? t.slice(0, 57).replace(/\s+\S*$/, "") + "…" : t;
}

/** Ohne KI: erste Nachricht ohne Befehl und Füllwörter, auf ganze Wörter gekürzt. */
export function fallbackTitle(text: string): string {
  const t = (text || "").replace(/^\/\w+\s*/, "").replace(/\s+/g, " ").replace(/^(hey|hi|hallo|moin|servus|bitte|kannst du( mir)?|könntest du( mir)?)[,!\s]+/i, "").trim();
  if (!t) return "Neuer Chat";
  const short = t.length > 40 ? t.slice(0, 40).replace(/\s+\S*$/, "") + "…" : t;
  return short.charAt(0).toUpperCase() + short.slice(1);
}

async function viaChatFunction(convo: string): Promise<string> {
  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
    // Gespräch im System-Teil, damit Bild- oder Befehlserkennung der Chat-Funktion nicht anspringt.
    body: JSON.stringify({ mythos: "v1:instant", messages: [{ role: "system", content: `${TITLE_SYSTEM}\n\n${convo}` }, { role: "user", content: "Gib nur den Titel aus." }] }),
  });
  if (!resp.ok || !resp.body) return "";
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "", out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, idx).trim(); buf = buf.slice(idx + 1);
      if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
      try { out += JSON.parse(line.slice(6)).choices?.[0]?.delta?.content || ""; } catch { /* Statuszeilen */ }
    }
    if (out.length > 200) { reader.cancel().catch(() => {}); break; }
  }
  return out;
}

/** Erzeugt einen Titel aus erster Nachricht und Antwort. Gibt nie leer zurück. */
export async function generateChatTitle(userText: string, aiText: string): Promise<string> {
  const convo = `Erste Nachricht:\n${(userText || "").slice(0, 1200)}\n\nAntwort:\n${(aiText || "").slice(0, 1200)}`;
  try {
    const { data } = await supabase.functions.invoke("suggest", { body: { kind: "title", user: userText.slice(0, 1200), ai: aiText.slice(0, 1200) } });
    const t = cleanTitle(typeof data?.title === "string" ? data.title : "");
    if (t) return t;
  } catch { /* weiter */ }
  try {
    const t = cleanTitle(await viaChatFunction(convo));
    if (t) return t;
  } catch { /* weiter */ }
  return fallbackTitle(userText);
}
