// Gezielte Änderungen an einer Datei (SUCHEN/ERSETZEN-Blöcke) statt die ganze Datei neu zu schreiben.
// Format, das die KI liefert:
//   <<<<<<< SUCHEN
//   alter Text (exakt aus der Datei)
//   =======
//   neuer Text
//   >>>>>>> ERSETZEN

export type Edit = { search: string; replace: string };
export type PatchResult = { html: string; applied: number; failed: Edit[] };

const BLOCK_RE = /^[ \t]*<{5,9}[ \t]*(?:SUCHEN|SEARCH)?[ \t]*\r?\n([\s\S]*?)\r?\n?^[ \t]*={5,9}[ \t]*\r?\n([\s\S]*?)\r?\n?^[ \t]*>{5,9}[ \t]*(?:ERSETZEN|REPLACE)?[ \t]*$/gm;

/** Alle vollständigen Änderungs-Blöcke aus einer Antwort lesen. */
export function parseEdits(text: string): Edit[] {
  const out: Edit[] = [];
  for (const m of String(text || "").matchAll(BLOCK_RE)) out.push({ search: m[1] ?? "", replace: m[2] ?? "" });
  return out;
}
/** Enthält die Antwort (auch unfertige) Änderungs-Blöcke? */
export const hasEditMarkers = (text: string) => /^[ \t]*<{5,9}[ \t]*(?:SUCHEN|SEARCH)\b/m.test(String(text || ""));
/** Wie viele Blöcke wurden schon begonnen (für die Live-Anzeige)? */
export const countEditStarts = (text: string) => (String(text || "").match(/^[ \t]*<{5,9}[ \t]*(?:SUCHEN|SEARCH)\b/gm) || []).length;

const indentOf = (l: string) => /^[ \t]*/.exec(l)![0];

/** Eine Änderung anwenden: exakt, sonst zeilenweise ohne Rücksicht auf Einrückung/Leerraum am Rand. null = Stelle nicht (eindeutig) gefunden. */
export function applyEdit(src: string, e: Edit): string | null {
  const crlf = src.includes("\r\n");
  const norm = (t: string) => (crlf ? t.replace(/\r?\n/g, "\r\n") : t.replace(/\r\n/g, "\n"));
  const search = norm(e.search), replace = norm(e.replace);
  // Leerer Such-Block: ans Ende vor </body> anfügen.
  if (!search.trim()) {
    const i = src.search(/<\/body>/i);
    return i >= 0 ? src.slice(0, i) + replace + (crlf ? "\r\n" : "\n") + src.slice(i) : src + (crlf ? "\r\n" : "\n") + replace;
  }
  const first = src.indexOf(search);
  if (first >= 0) {
    if (src.indexOf(search, first + 1) >= 0) return null; // nicht eindeutig
    // Löschen ganzer Zeilen: keine leere Zeile zurücklassen.
    if (!replace.trim()) {
      const a = src.lastIndexOf("\n", first - 1) + 1, end = first + search.length;
      if (/^[ \t]*$/.test(src.slice(a, first)) && (src[end] === "\n" || src.slice(end, end + 2) === "\r\n" || end === src.length)) return src.slice(0, a) + src.slice(end + (src[end] === "\r" ? 2 : src[end] === "\n" ? 1 : 0));
    }
    // Begann der Such-Text mitten in der Einrückung, die Folgezeilen des neuen Textes genauso tief einrücken.
    const ls = src.lastIndexOf("\n", first - 1) + 1, pre = src.slice(ls, first);
    const rep = pre && /^[ \t]+$/.test(pre) && replace.includes("\n") ? replace.split("\n").map((l, i) => (i && l.trim() && !l.startsWith(pre) ? pre + l : l)).join("\n") : replace;
    return src.slice(0, first) + rep + src.slice(first + search.length);
  }
  const nl = crlf ? "\r\n" : "\n";
  const F = src.split(nl);
  const O = search.split(nl); while (O.length && !O[0].trim()) O.shift(); while (O.length && !O[O.length - 1].trim()) O.pop();
  if (!O.length) return null;
  const key = O.map((l) => l.trim());
  const hits: number[] = [];
  for (let i = 0; i + key.length <= F.length; i++) {
    let ok = true;
    for (let k = 0; k < key.length; k++) if (F[i + k].trim() !== key[k]) { ok = false; break; }
    if (ok) hits.push(i);
  }
  if (hits.length !== 1) return null;
  const h = hits[0];
  let N = replace.split(nl); while (N.length && !N[0].trim()) N.shift(); while (N.length && !N[N.length - 1].trim()) N.pop();
  const oInd = indentOf(O.find((l) => l.trim()) || ""), fInd = indentOf(F[h]);
  if (oInd !== fInd) N = N.map((l) => (!l.trim() ? l : l.startsWith(oInd) ? fInd + l.slice(oInd.length) : fInd + l.trimStart()));
  return [...F.slice(0, h), ...N, ...F.slice(h + key.length)].join(nl);
}

/** Alle Änderungen der Reihe nach anwenden; was nicht passt, wird gesammelt (der Rest gilt trotzdem). */
export function applyEdits(src: string, edits: Edit[]): PatchResult {
  let html = src, applied = 0;
  const failed: Edit[] = [];
  for (const e of edits) {
    if (e.search === e.replace) continue;
    const next = applyEdit(html, e);
    if (next == null) failed.push(e); else { html = next; applied++; }
  }
  return { html, applied, failed };
}

/** Grobe Zahl geänderter Zeilen (für „12 Zeilen geändert“). */
export function changedLines(a: string, b: string): number {
  const A = a.split("\n"), B = b.split("\n");
  let s = 0; while (s < A.length && s < B.length && A[s] === B[s]) s++;
  let ea = A.length, eb = B.length; while (ea > s && eb > s && A[ea - 1] === B[eb - 1]) { ea--; eb--; }
  const setA = new Map<string, number>(); for (let i = s; i < ea; i++) setA.set(A[i], (setA.get(A[i]) || 0) + 1);
  let same = 0; for (let i = s; i < eb; i++) { const n = setA.get(B[i]) || 0; if (n) { same++; setA.set(B[i], n - 1); } }
  return Math.max(ea - s, eb - s) - same;
}

/** Nachricht an die KI, wenn Blöcke nicht gepasst haben. */
export function repairPrompt(failed: Edit[]): string {
  return "Diese SUCHEN-Blöcke wurden in der aktuellen index.html NICHT (eindeutig) gefunden – sie müssen Zeichen für Zeichen einem Stück der Datei entsprechen und dürfen nur einmal vorkommen:\n\n" +
    failed.slice(0, 6).map((f, i) => `Block ${i + 1}:\n${f.search.slice(0, 600)}`).join("\n\n") +
    "\n\nSchau in die aktuelle Datei oben und sende NUR diese Änderungen noch einmal als SUCHEN/ERSETZEN-Blöcke, mit exakt kopiertem SUCHEN-Text (2–6 Zeilen, eindeutig). Alle anderen Änderungen sind schon übernommen – nicht wiederholen.";
}
