// Selbst prüfen wie Claude: Nach einer Antwort mit Dateien testet der Chat das Ergebnis
// und lässt Mythos bei Problemen automatisch EINE Verbesserungsrunde machen.
// - .bbmodel: lässt sich bauen? genug Würfel (Detail)?
// - .html: startet die Seite ohne JavaScript-Fehler? (unsichtbar, in einer Sandbox)
import { splitFiles } from "@/lib/chatFileParts";
import { finishBBModel } from "@/lib/bbmodel";
import { extOf } from "@/lib/chatFiles";

export const MIN_CUBES = 20;

/** HTML unsichtbar starten und Fehler einsammeln (Sandbox ohne Zugriff auf die Seite). */
export function runHtml(html: string, ms = 3500): Promise<string[]> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") { resolve([]); return; }
    const id = "chk" + Math.random().toString(36).slice(2);
    const errors: string[] = [];
    const probe = `<script>(function(){var s=function(m){try{parent.postMessage({__mythosCheck:${JSON.stringify(id)},m:String(m).slice(0,300)},"*")}catch(e){}};` +
      `window.addEventListener("error",function(e){s((e.message||"Fehler")+(e.lineno?" (Zeile "+e.lineno+")":""))});` +
      `window.addEventListener("unhandledrejection",function(e){s("Promise: "+(e.reason&&e.reason.message||e.reason))});` +
      `var ce=console.error;console.error=function(){s([].slice.call(arguments).join(" "));ce.apply(console,arguments)};})();</script>`;
    const doc = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (h) => h + probe) : probe + html;
    const f = document.createElement("iframe");
    f.setAttribute("sandbox", "allow-scripts");
    f.style.cssText = "position:fixed;left:-10000px;top:0;width:800px;height:600px;opacity:0;pointer-events:none";
    const onMsg = (e: MessageEvent) => { if (e.data && e.data.__mythosCheck === id && errors.length < 8) errors.push(e.data.m); };
    window.addEventListener("message", onMsg);
    f.srcdoc = doc;
    document.body.appendChild(f);
    setTimeout(() => { window.removeEventListener("message", onMsg); f.remove(); resolve([...new Set(errors)]); }, ms);
  });
}

/** Probleme in den Dateien einer Antwort (leer = alles gut). */
export async function checkAnswer(content: string): Promise<string[]> {
  const problems: string[] = [];
  const { files } = splitFiles(content);
  for (const f of files) {
    const e = extOf(f.name);
    if (e === "bbmodel") {
      const r = finishBBModel(f.content);
      if (r.ok === false) problems.push(`${f.name}: ${r.error}.`);
      else if (r.cubes < MIN_CUBES) problems.push(`${f.name} hat nur ${r.cubes} Würfel – viel zu wenig Detail (mindestens ${MIN_CUBES}, besser 30–60).`);
    } else if (e === "html" || e === "htm") {
      const errs = await runHtml(f.content);
      // Netzwerkfehler externer Quellen (CDN offline in der Sandbox) nicht als Code-Fehler werten
      const real = errs.filter((x) => !/Failed to load|net::|NetworkError|Script error\.?$/i.test(x));
      if (real.length) problems.push(`${f.name} wirft beim Start JavaScript-Fehler:\n- ${real.join("\n- ")}`);
    } else if (e === "json") {
      try { JSON.parse(f.content); } catch (err) { problems.push(`${f.name} ist kein gültiges JSON (${(err as Error).message}).`); }
    }
  }
  return problems;
}

export const repairPrompt = (problems: string[]) =>
  "🔧 Automatische Prüfung hat Probleme gefunden:\n" + problems.map((p) => "- " + p).join("\n") +
  "\n\nBitte behebe ALLE Punkte und schicke die betroffene(n) Datei(en) komplett und verbessert neu (am Ende der Antwort). Kurz sagen, was du geändert hast.";
