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
  return [
    `Zeichne diese Grafik als SVG-Code: «${motif}»`,
    "",
    "So (verbindlich):",
    "- Antworte mit höchstens einem kurzen Satz und danach GENAU EINEM ```svg Codeblock – sonst nichts, keine Rückfragen.",
    "- Vollständiges <svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"…\"> – Szene/Bild 0 0 1600 900, Logo/Icon/Avatar 0 0 512 512, Poster 0 0 1080 1350.",
    "- Richtig detailliert und schön: Hintergrund mit Verlauf, mehrere Ebenen (hinten/mitte/vorne), Formen mit <path> statt Grundkörpern, linear-/radialGradient für Licht und Plastizität, weiche Schatten (filter feGaussianBlur/feDropShadow), Highlights, stimmige Farbpalette, Details wie Texturen/Muster.",
    "- Alles, was im Wunsch vorkommt, muss klar erkennbar sein. Text nur, wenn er gewünscht ist (dann gut lesbar).",
    "- Keine externen Bilder, Schriften oder Skripte. Kein Bildgenerator – du zeichnest selbst.",
    "- Steht im Wunsch ein Format (z. B. 1028×1028), nimm genau diese viewBox.",
    "- Bei Änderungswünschen an einer vorherigen Grafik: die vorherige Grafik übernehmen und nur verbessern, nichts weglassen.",
  ].join("\n");
}
