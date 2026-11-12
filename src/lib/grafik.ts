// /grafik – Grafiken als SVG zeichnen lassen. Läuft über den normalen Chat (keine neue Server-Funktion nötig):
// die Anfrage wird so umformuliert, dass die KI genau einen SVG-Codeblock liefert, der im Chat als Bild erscheint.
import { isImageRequest } from "@/lib/imageIntent";

const DRAW = /^\s*(?:bitte\s+)?(?:zeichne|zeichnen|male|mal mir|skizzier\w*|illustrier\w*|entwirf|entwerf\w*|gestalte|design\w*)\b|\b(?:grafik|logo|icon|poster|banner|thumbnail|wallpaper|hintergrundbild|illustration|zeichnung|avatar|profilbild|sticker|emblem|wappen)\b/i;
const NOT_DRAW = /\b(app|website|webseite|spiel|game|seite|html|code|programm|skript|script|3d|three|animation|animier|plugin|mod|datei|tabelle|text|gedicht|song|lied|video|film)\b/i;

/** Will der Nutzer eine Grafik? `/grafik …` immer; sonst Bild-/Zeichen-Wünsche ohne App-/Code-Bezug. */
export function grafikRequest(text: string, hasAttachments: boolean): string | null {
  const t = text.trim();
  const m = t.match(/^\/(?:grafik|bild|image|zeichne)\b\s*([\s\S]*)$/i);
  if (m) return m[1].trim() || null;
  if (hasAttachments || t.startsWith("/") || t.length > 500) return null;
  if (NOT_DRAW.test(t)) return null;
  if (isImageRequest(t) || DRAW.test(t)) return t;
  return null;
}

/** Anweisung an die KI (das Wort „SVG“ sorgt dafür, dass auch ältere Server-Versionen keinen Bildgenerator starten). */
export function grafikPrompt(motif: string): string {
  // Beginnt mit „/grafik“: so startet der Server keine Internet-Suche (Grafiken brauchen keine).
  return [
    `/grafik – zeichne als SVG-Code: «${motif}»`,
    "",
    "So (verbindlich):",
    "- Wiederhole diesen Auftrag NICHT. Schreib höchstens einen kurzen Satz (z. B. „Hier ist dein Gaming-PC:“) und dann sofort GENAU EINEN ```svg Codeblock – sonst nichts, keine Rückfragen.",
    "- Vollständiges <svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"…\"> – Szene/Bild 0 0 1600 900, Logo/Icon/Avatar 0 0 512 512, Poster 0 0 1080 1350.",
    "- Richtig detailliert und schön: Hintergrund mit Verlauf, mehrere Ebenen (hinten/mitte/vorne), Formen mit <path> statt Grundkörpern, linear-/radialGradient für Licht und Plastizität, weiche Schatten (filter feGaussianBlur/feDropShadow), Highlights, stimmige Farbpalette, Details wie Texturen/Muster.",
    "- Alles, was im Wunsch vorkommt, muss klar erkennbar sein. Text nur, wenn er gewünscht ist (dann gut lesbar).",
    "- Keine externen Bilder, Schriften oder Skripte. Kein Bildgenerator – du zeichnest selbst.",
    "- Steht im Wunsch ein Format (z. B. 1028×1028), nimm genau diese viewBox.",
    "- Bei Änderungswünschen an einer vorherigen Grafik: die vorherige Grafik übernehmen und nur verbessern, nichts weglassen.",
  ].join("\n");
}

/** Ein noch unfertiges SVG (während die KI schreibt) so schließen, dass es schon angezeigt werden kann. */
export function closePartialSvg(code: string): string | null {
  const start = code.search(/<svg[\s>]/i);
  if (start < 0) return null;
  let s = code.slice(start);
  const lastGt = s.lastIndexOf(">");
  if (lastGt < 0) return null;
  s = s.slice(0, lastGt + 1);
  // offene Container-Tags zählen und schließen
  const stack: string[] = [];
  const re = /<\/?([a-zA-Z][\w:-]*)[^>]*?(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const tag = m[1], selfClose = m[2] === "/" || /\/>$/.test(m[0]);
    if (m[0].startsWith("</")) { const i = stack.lastIndexOf(tag); if (i >= 0) stack.length = i; }
    else if (!selfClose) stack.push(tag);
  }
  // Text in einem offenen <text>/<style> ist ok; offenes <script> nie anzeigen
  s = s.replace(/<script[\s\S]*$/i, "");
  return s + stack.reverse().map((t) => `</${t}>`).join("");
}
