// Blockbench-Modelle (.bbmodel) aus einer KOMPAKTEN Beschreibung bauen.
//
// Warum: Eine echte .bbmodel ist riesig (jede Würfelseite hat UV + Textur-ID, dazu eine Base64-Textur).
// Das sprengt das Antwort-Limit des Modells – heraus kam eine abgeschnittene oder leere Datei.
// Darum schreibt Mythos nur die Würfel (Name, Position, Farbe) und der Chat baut daraus
// eine vollständige, gültige .bbmodel (Format 4.5, java_block) inkl. Farb-Textur.
//
// Kompaktes Format (alles außer cubes ist optional):
// {
//   "name": "Strohhut",
//   "cubes": [
//     { "name": "krempe", "from": [1,5,1], "to": [15,6,15], "color": "#d8b45a" },
//     { "name": "band", "from": [4,6,4], "to": [12,7,12], "color": "#7a2e1d",
//       "origin": [8,6,8], "rotation": [0,45,0], "faces": { "up": "#a0402a" } }
//   ]
// }
// Auch erlaubt: "elements" statt "cubes", "c" statt "color", "o" statt "origin", "r" statt "rotation".
// Eine bereits vollständige .bbmodel wird nur geprüft und unverändert durchgereicht.

export type CompactCube = {
  name?: string;
  from: number[];
  to: number[];
  color?: string;
  c?: string;
  origin?: number[];
  o?: number[];
  rotation?: number[];
  r?: number[];
  faces?: Partial<Record<Face, string>>;
  group?: string;
};
export type CompactModel = { name?: string; id?: string; cubes?: CompactCube[]; elements?: CompactCube[] };

const FACES = ["north", "east", "south", "west", "up", "down"] as const;
type Face = (typeof FACES)[number];

// ---------- kleine Helfer ----------
const hex = (n: number, w = 2) => n.toString(16).padStart(w, "0");
let seed = 1;
/** Deterministische UUID (gleiche Eingabe = gleiche Datei, wichtig für Tests und Wiederholbarkeit). */
const uuid = () => {
  const r = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed; };
  const h = Array.from({ length: 4 }, () => hex(r(), 8)).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "") || "modell";
const num3 = (v: unknown, fb: number[]) =>
  Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === "number" && Number.isFinite(x)) ? (v as number[]) : fb;

function parseColor(c: unknown): [number, number, number, number] {
  const s = String(c || "").trim();
  const m = /^#?([0-9a-f]{3,8})$/i.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.split("").map((x) => x + x).join("");
    const v = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return [v(0), v(2), v(4), h.length === 8 ? v(6) : 255];
  }
  return [180, 180, 180, 255];
}

// ---------- PNG ohne Canvas (läuft auch in Tests/Workern) ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b: Uint8Array) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

function png(w: number, h: number, rgba: Uint8Array): string {
  // Rohdaten: pro Zeile Filter-Byte 0 + RGBA
  const raw = new Uint8Array(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
  // zlib mit "stored" Deflate-Blöcken (keine Kompression nötig – Texturen sind winzig)
  const blocks: number[] = [0x78, 0x01];
  for (let i = 0; i < raw.length || i === 0; i += 65535) {
    const part = raw.subarray(i, Math.min(i + 65535, raw.length));
    const last = i + 65535 >= raw.length ? 1 : 0;
    blocks.push(last, part.length & 255, part.length >> 8, ~part.length & 255, (~part.length >> 8) & 255, ...part);
    if (last) break;
  }
  let a = 1, b = 0;
  for (let i = 0; i < raw.length; i++) { a = (a + raw[i]) % 65521; b = (b + a) % 65521; }
  blocks.push(...u32(((b << 16) | a) >>> 0));
  const chunk = (type: string, data: number[] | Uint8Array) => {
    const td = new Uint8Array(4 + data.length);
    td.set([...type].map((ch) => ch.charCodeAt(0)), 0); td.set(data, 4);
    return [...u32(data.length), ...td, ...u32(crc32(td))];
  };
  const bytes = new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10,
    ...chunk("IHDR", [...u32(w), ...u32(h), 8, 6, 0, 0, 0]),
    ...chunk("IDAT", new Uint8Array(blocks)),
    ...chunk("IEND", []),
  ]);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return "data:image/png;base64," + btoa(bin);
}

/** Ist das eine kompakte Beschreibung (statt einer fertigen .bbmodel)? */
export function isCompactModel(v: unknown): v is CompactModel {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (o.meta && Array.isArray(o.elements) && (o.elements as Array<Record<string, unknown>>).some((e) => e && e.faces)) return false;
  return Array.isArray(o.cubes) || Array.isArray(o.elements);
}

/** Kompakte Beschreibung → vollständige .bbmodel (JSON-Objekt). */
export function buildBBModel(spec: CompactModel): Record<string, unknown> {
  seed = 1;
  const cubes = (spec.cubes || spec.elements || []).filter((c) => c && Array.isArray(c.from) && Array.isArray(c.to));
  if (!cubes.length) throw new Error("Modell hat keine Würfel");
  const name = String(spec.name || "Modell").slice(0, 80);

  // Farbpalette: jede Farbe bekommt ein 4×4-Feld in der Textur (Rand 1 px gegen Ausbluten).
  const colors: string[] = [];
  const idx = (c: unknown) => { const k = parseColor(c).map((x) => hex(x)).join(""); let i = colors.indexOf(k); if (i < 0) { colors.push(k); i = colors.length - 1; } return i; };
  const cols = Math.max(1, Math.ceil(Math.sqrt(cubes.length * 2)));
  let size = 16;
  // Zuerst alle Farben einsammeln, dann Texturgröße festlegen
  const faceColor = cubes.map((cube) => Object.fromEntries(FACES.map((f) => [f, idx(cube.faces?.[f] ?? cube.color ?? cube.c)])) as Record<Face, number>);
  const gridCols = Math.max(cols, Math.ceil(Math.sqrt(colors.length)));
  while (size < gridCols * 4) size *= 2;
  const rows = Math.ceil(colors.length / (size / 4));
  while (size < rows * 4) size *= 2;

  const rgba = new Uint8Array(size * size * 4);
  colors.forEach((k, i) => {
    const [r, g, b, a] = parseColor("#" + k);
    const cx = (i % (size / 4)) * 4, cy = Math.floor(i / (size / 4)) * 4;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      // ganz leichte Struktur, damit Flächen nicht wie Plastik wirken
      const j = ((x * 7 + y * 13 + i * 3) % 5) - 2;
      const p = ((cy + y) * size + cx + x) * 4;
      rgba[p] = Math.max(0, Math.min(255, r + j * 3)); rgba[p + 1] = Math.max(0, Math.min(255, g + j * 3)); rgba[p + 2] = Math.max(0, Math.min(255, b + j * 3)); rgba[p + 3] = a;
    }
  });
  const uvOf = (i: number) => { const cx = (i % (size / 4)) * 4, cy = Math.floor(i / (size / 4)) * 4; return [cx + 1, cy + 1, cx + 3, cy + 3]; };

  const texUuid = uuid();
  const elements = cubes.map((cube, n) => {
    const from = num3(cube.from, [0, 0, 0]), to = num3(cube.to, [1, 1, 1]);
    const lo = from.map((v, i) => Math.min(v, to[i])), hi = from.map((v, i) => Math.max(v, to[i]));
    const center = lo.map((v, i) => (v + hi[i]) / 2);
    const el: Record<string, unknown> = {
      name: String(cube.name || `wuerfel_${n + 1}`),
      box_uv: false,
      type: "cube",
      uuid: uuid(),
      from: lo,
      to: hi,
      origin: num3(cube.origin ?? cube.o, center),
      faces: Object.fromEntries(FACES.map((f) => [f, { uv: uvOf(faceColor[n][f]), texture: texUuid }])),
    };
    const rot = num3(cube.rotation ?? cube.r, [0, 0, 0]);
    if (rot.some((v) => v)) el.rotation = rot;
    return el;
  });

  // Gruppen (optional): "group" am Würfel → Ordner im Outliner
  const groups = new Map<string, string[]>();
  const outliner: unknown[] = [];
  elements.forEach((el, i) => {
    const g = cubes[i].group;
    if (!g) { outliner.push(el.uuid); return; }
    if (!groups.has(g)) { groups.set(g, []); outliner.push({ name: g, origin: [8, 0, 8], uuid: uuid(), export: true, isOpen: true, visibility: true, children: groups.get(g) }); }
    groups.get(g)!.push(el.uuid as string);
  });

  return {
    meta: { format_version: "4.5", model_format: "java_block", box_uv: false },
    name,
    model_identifier: slug(spec.id || name),
    resolution: { width: size, height: size },
    elements,
    outliner,
    textures: [{
      name: `${slug(name)}_atlas.png`, folder: "block", namespace: "", id: "0",
      width: size, height: size, uv_width: size, uv_height: size, frame_time: 1, particle: false,
      render_mode: "default", visible: true, internal: true, saved: false, uuid: texUuid,
      source: png(size, size, rgba),
    }],
  };
}

/** Text einer .bbmodel-Datei aus dem Chat → fertiger Dateiinhalt (oder Fehler, wenn leer/kaputt). */
export function finishBBModel(text: string): { ok: true; content: string; cubes: number } | { ok: false; error: string } {
  let data: unknown;
  try { data = JSON.parse(text.trim().replace(/^```[^\n]*\n|```$/g, "")); }
  catch { return { ok: false, error: "Kein gültiges JSON (wahrscheinlich abgeschnitten)" }; }
  try {
    if (isCompactModel(data)) {
      const full = buildBBModel(data);
      return { ok: true, content: JSON.stringify(full), cubes: (full.elements as unknown[]).length };
    }
    const els = (data as { elements?: unknown[] }).elements;
    if (!Array.isArray(els) || !els.length) return { ok: false, error: "Modell ist leer (keine Würfel)" };
    return { ok: true, content: text, cubes: els.length };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
