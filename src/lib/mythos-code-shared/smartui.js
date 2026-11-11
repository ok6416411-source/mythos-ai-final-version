// ---------- Intelligente Oberfläche („Smart UI“) für Mythos-Antworten ----------
// Mythos schreibt statt reinem Text einen Block ```mythos-ui {…JSON…}```. Daraus entstehen hier
// echte Bedienelemente: Karten mit Bildern, Auswahl, Regler-Rechner, Diagramme, Formeln, Karte,
// Ablauf, Zeitplan, Checklisten, Quiz, Buttons, Prompt-Karten.
// Reines DOM ohne innerHTML für Modelltext und ohne Abhängigkeiten: läuft im Web-Chat (React-Hülle)
// und in der Code-App (Electron, wird dort als smartui.js mitgeliefert).
//   MythosSmartUI.render(rawJson, { send(text), openLink(url), copy(text), blobImages }) → Element
//   MythosSmartUI.PROMPT  → Anleitung für das Modell
(function () {
  const W = typeof window !== "undefined" ? window : globalThis;
  if (W.MythosSmartUI) return;
  const NS = "http://www.w3.org/2000/svg";

  // ---------- Stil (einmal pro Seite) ----------
  const CSS = `
.msui{--a:var(--msui-accent,#a78bfa);--bg:rgba(255,255,255,.035);--bd:rgba(255,255,255,.1);--mut:rgba(255,255,255,.55);--fg:inherit;margin:10px 0 14px;display:flex;flex-direction:column;gap:12px;font-size:14px;line-height:1.5;max-width:640px}
.msui *{box-sizing:border-box}
.msui-box{border:1px solid var(--bd);background:var(--bg);border-radius:16px;padding:14px 16px}
.msui-h{font-weight:650;font-size:15.5px;margin:0 0 6px}
.msui-sub{color:var(--mut);font-size:12.5px;margin:0 0 10px}
.msui-mut{color:var(--mut);font-size:12px}
.msui-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.msui-card{border:1px solid var(--bd);border-radius:14px;overflow:hidden;background:rgba(255,255,255,.03);display:flex;flex-direction:column}
.msui-card.row{flex-direction:row;align-items:stretch}
.msui-card.row .msui-img{width:110px;min-height:100%;aspect-ratio:auto;flex-shrink:0}
.msui-card .in{padding:9px 11px;display:flex;flex-direction:column;gap:3px;min-width:0}
.msui-card .t{font-weight:600;font-size:14px}
.msui-card .s{color:var(--mut);font-size:12px}
.msui-card .x{font-size:13px;opacity:.9}
.msui-img{aspect-ratio:4/3;width:100%;background:linear-gradient(135deg,rgba(167,139,250,.25),rgba(56,189,248,.15));display:flex;align-items:center;justify-content:center;font-size:30px;overflow:hidden;position:relative}
.msui-img img{width:100%;height:100%;object-fit:cover;display:block}
.msui-img .ini{font-weight:700;font-size:26px;opacity:.8}
.msui-badges{display:flex;flex-wrap:wrap;gap:4px;margin-top:3px}
.msui-badge{font-size:11px;padding:1px 7px;border-radius:99px;border:1px solid var(--bd);color:var(--mut)}
.msui-opts{display:flex;flex-direction:column;gap:2px;margin:4px 0 8px}
.msui-opt{display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:10px;cursor:pointer;border:0;background:none;color:inherit;font:inherit;text-align:left}
.msui-opt:hover{background:rgba(255,255,255,.05)}
.msui-radio{width:17px;height:17px;border-radius:50%;border:2px solid var(--mut);flex-shrink:0;display:flex;align-items:center;justify-content:center}
.msui-opt.on .msui-radio{border-color:currentColor}
.msui-opt.on .msui-radio::after{content:"";width:9px;height:9px;border-radius:50%;background:currentColor}
.msui-pane{border-top:1px solid var(--bd);padding-top:10px;margin-top:2px}
.msui-pane .pt{font-weight:600;margin-bottom:3px}
.msui-field{margin:10px 0 4px}
.msui-fl{display:flex;justify-content:space-between;gap:8px;font-size:13.5px;margin-bottom:4px}
.msui-fl b{font-variant-numeric:tabular-nums}
.msui input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:4px;border-radius:99px;background:rgba(255,255,255,.15);outline:none;margin:10px 0 4px}
.msui input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:34px;height:20px;border-radius:99px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.5);cursor:pointer}
.msui input[type=range]::-moz-range-thumb{width:34px;height:20px;border:0;border-radius:99px;background:#fff;cursor:pointer}
.msui-scale{display:flex;justify-content:space-between;font-size:10.5px;color:var(--mut)}
.msui-num{width:100%;padding:7px 10px;border-radius:10px;border:1px solid var(--bd);background:rgba(0,0,0,.25);color:inherit;font:inherit}
.msui-result{border-top:1px solid var(--bd);margin-top:12px;padding-top:10px}
.msui-big{font-size:28px;font-weight:700;margin:2px 0 6px;font-variant-numeric:tabular-nums}
.msui-kv{display:flex;justify-content:space-between;gap:8px;padding:3px 0;font-size:13.5px}
.msui-kv b{font-variant-numeric:tabular-nums;font-weight:600}
.msui-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}
.msui-stat{border:1px solid var(--bd);border-radius:12px;padding:9px 11px}
.msui-stat .v{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums}
.msui-visual{margin-top:10px;border-radius:12px;background:rgba(255,255,255,.04);padding:8px;display:flex;justify-content:center}
.msui-visual svg{max-width:100%;height:auto}
.msui-formula{font-family:"Cambria Math","Latin Modern Math","Times New Roman",serif;font-size:22px;text-align:center;padding:8px 0;font-style:italic;letter-spacing:.02em}
.msui-formula sup,.msui-formula sub{font-size:.62em}
.msui-steps{display:flex;flex-direction:column;align-items:stretch;gap:0}
.msui-step{border:1px solid var(--bd);border-radius:14px;padding:11px 13px;text-align:center;background:rgba(255,255,255,.03)}
.msui-step.last{border-color:rgba(74,222,128,.35);background:rgba(74,222,128,.07)}
.msui-step .i{font-size:20px}
.msui-step .t{font-weight:600}
.msui-step .x{color:var(--mut);font-size:12.5px}
.msui-arrow{text-align:center;color:var(--mut);line-height:1;padding:4px 0}
.msui-tl{display:flex;flex-direction:column}
.msui-tli{display:flex;gap:12px;position:relative;padding-bottom:12px}
.msui-tli .tm{width:58px;flex-shrink:0;font-size:12.5px;font-weight:600;font-variant-numeric:tabular-nums;padding-top:1px}
.msui-tli .dot{width:11px;height:11px;border-radius:50%;background:var(--a);margin-top:5px;flex-shrink:0;position:relative}
.msui-tli:not(:last-child) .dot::after{content:"";position:absolute;left:4px;top:13px;width:2px;height:calc(100% + 30px);background:var(--bd)}
.msui-check{display:flex;gap:10px;align-items:flex-start;padding:6px 4px;cursor:pointer;border-radius:8px}
.msui-check:hover{background:rgba(255,255,255,.04)}
.msui-cb{width:18px;height:18px;border-radius:5px;border:2px solid var(--mut);flex-shrink:0;margin-top:2px;display:flex;align-items:center;justify-content:center;font-size:12px;line-height:1}
.msui-check.on .msui-cb{background:var(--a);border-color:var(--a);color:#fff}
.msui-check.on .ct{text-decoration:line-through;opacity:.55}
.msui-btns{display:flex;flex-wrap:wrap;gap:8px}
.msui-q-opt{display:flex;align-items:flex-start;gap:10px;width:100%;padding:9px 11px;margin:0 0 6px;border:1px solid var(--bd);border-radius:12px;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.msui-q-opt:hover{border-color:rgba(255,255,255,.25)}
.msui-q-opt.on{border-color:var(--a);background:color-mix(in srgb,var(--a) 10%,transparent)}
.msui-q-opt .k{flex-shrink:0;width:20px;height:20px;border-radius:6px;border:1.5px solid var(--mut);display:flex;align-items:center;justify-content:center;font-size:12px;margin-top:1px}
.msui-q-opt.on .k{background:var(--a);border-color:var(--a);color:#fff}
.msui-q-opt .d{display:block;color:var(--mut);font-size:12.5px}
.msui-q-other{width:100%;padding:9px 11px;border:1px solid var(--bd);border-radius:12px;background:transparent;color:inherit;font:inherit;margin:0 0 10px;outline:none}
.msui-q-other:focus{border-color:var(--a)}
.msui-q-send{border:0;background:var(--a);color:#fff;font:inherit;font-weight:600;font-size:13.5px;padding:8px 16px;border-radius:10px;cursor:pointer}
.msui-q-send:disabled{opacity:.35;cursor:default}
.msui-q-done{display:flex;gap:8px;align-items:center;color:var(--mut);font-size:13px}
.msui-pinref{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--bd);border-radius:99px;padding:5px 12px;font-size:12.5px;color:var(--mut)}
.msui-btn{border:1px solid var(--bd);background:rgba(255,255,255,.05);color:inherit;font:inherit;font-size:13px;padding:7px 13px;border-radius:99px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.msui-btn:hover{background:rgba(255,255,255,.1)}
.msui-btn.wide{width:100%;justify-content:center;border-radius:12px;margin-top:10px}
.msui-btn.ok{border-color:rgba(74,222,128,.5);background:rgba(74,222,128,.12)}
.msui-btn.bad{border-color:rgba(248,113,113,.5);background:rgba(248,113,113,.12)}
.msui-quote{font-style:italic;opacity:.9}
.msui-map{width:100%;height:220px;border:0;border-radius:12px;margin:4px 0 10px;background:#1a1a1a}
.msui-legend{display:flex;flex-wrap:wrap;gap:10px;font-size:12px;color:var(--mut);margin-top:6px}
.msui-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.msui-table{width:100%;border-collapse:collapse;font-size:13px}
.msui-table th{text-align:left;font-weight:600;border-bottom:1px solid var(--bd);padding:6px 8px;cursor:pointer;white-space:nowrap}
.msui-table td{border-bottom:1px solid rgba(255,255,255,.05);padding:6px 8px;vertical-align:top}
.msui-scroll{overflow-x:auto}
.msui-gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px}
.msui-gal figure{margin:0}
.msui-gal .msui-img{border-radius:12px}
.msui-gal figcaption{font-size:12px;color:var(--mut);margin-top:4px}
.msui-wait{border:1px dashed var(--bd);border-radius:16px;padding:16px;color:var(--mut);font-size:13px;display:flex;align-items:center;gap:8px}
.msui-wait::before{content:"";width:12px;height:12px;border-radius:50%;border:2px solid var(--mut);border-top-color:transparent;animation:msui-spin 1s linear infinite}
@keyframes msui-spin{to{transform:rotate(360deg)}}
body.light .msui,html.light .msui{--bg:rgba(0,0,0,.025);--bd:rgba(0,0,0,.12);--mut:rgba(0,0,0,.55)}
html.light .msui-q-opt:hover,html.light .msui-check:hover{background:rgba(0,0,0,.03);border-color:rgba(0,0,0,.25)}
html.light .msui-btn{background:rgba(0,0,0,.03)}
body.light .msui input[type=range]{background:rgba(0,0,0,.15)}
body.light .msui input[type=range]::-webkit-slider-thumb{background:#fff;border:1px solid rgba(0,0,0,.2)}
body.light .msui-num{background:#fff}
`;
  function ensureCss() {
    if (typeof document === "undefined" || document.getElementById("msui-css")) return;
    const s = document.createElement("style"); s.id = "msui-css"; s.textContent = CSS; document.head.appendChild(s);
  }

  // ---------- Helfer ----------
  const mk = (tag, cls, text) => { const d = document.createElement(tag); if (cls) d.className = cls; if (text != null) d.textContent = String(text); return d; };
  const svg = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs || {}) e.setAttribute(k, attrs[k]); return e; };
  const arr = (x) => (Array.isArray(x) ? x : x == null ? [] : [x]);
  const str = (x) => (x == null ? "" : typeof x === "object" ? (x.text || x.label || x.title || "") : String(x));
  // **fett** und Zeilenumbrüche, sonst reiner Text.
  function rich(parent, text) {
    String(text || "").split(/(\*\*[^*]+\*\*)/g).forEach((p) => {
      if (/^\*\*[^*]+\*\*$/.test(p)) parent.appendChild(mk("strong", "", p.slice(2, -2)));
      else p.split("\n").forEach((line, i) => { if (i) parent.appendChild(document.createElement("br")); if (line) parent.appendChild(document.createTextNode(line)); });
    });
    return parent;
  }
  const PALETTE = ["#a78bfa", "#38bdf8", "#4ade80", "#fbbf24", "#f472b6", "#fb923c", "#2dd4bf", "#f87171"];
  const color = (i, c) => (typeof c === "string" && /^#[0-9a-f]{3,8}$|^[a-z]+$/i.test(c) ? c : PALETTE[i % PALETTE.length]);

  // ---------- Zahlen ----------
  function fmt(v, f, unit, dec) {
    if (typeof v !== "number" || !isFinite(v)) return v === Infinity ? "∞" : "–";
    const d = dec != null ? dec : Math.abs(v) >= 100 || Number.isInteger(v) ? 0 : 2;
    const n = (x, dd) => x.toLocaleString("de-DE", { minimumFractionDigits: dd, maximumFractionDigits: dd });
    switch (f) {
      case "eur": case "euro": case "€": return n(v, dec != null ? dec : Number.isInteger(Math.round(v * 100) / 100) ? 0 : 2) + " €";
      case "usd": case "$": return n(v, dec != null ? dec : 2) + " $";
      case "percent": case "%": return n(v, dec != null ? dec : 1) + " %";
      case "int": return n(Math.round(v), 0) + (unit ? " " + unit : "");
      default: return n(v, d) + (unit ? " " + unit : "");
    }
  }

  // Kleiner, sicherer Rechenausdruck-Parser (kein eval): + - * / % ^, Vergleiche, Klammern, Funktionen, Variablen.
  const FN = {
    sqrt: Math.sqrt, abs: Math.abs, min: Math.min, max: Math.max, pow: Math.pow, floor: Math.floor, ceil: Math.ceil,
    exp: Math.exp, ln: Math.log, log: (x, b) => (b ? Math.log(x) / Math.log(b) : Math.log10(x)), log10: Math.log10,
    sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
    round: (x, d) => { const p = Math.pow(10, d || 0); return Math.round(x * p) / p; },
    if: (c, a, b) => (c ? a : b), clamp: (x, a, b) => Math.min(b, Math.max(a, x)),
    sum: (...a) => a.reduce((s, x) => s + x, 0), avg: (...a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0),
    deg: (r) => (r * 180) / Math.PI, rad: (d) => (d * Math.PI) / 180,
  };
  const CONST = { pi: Math.PI, e: Math.E, PI: Math.PI };
  function compile(src) {
    const toks = String(src).replace(/×/g, "*").replace(/÷/g, "/").replace(/,(?=\s*\d)/g, ",").match(/\d+(?:\.\d+)?(?:e[+-]?\d+)?|[A-Za-z_]\w*|>=|<=|==|!=|&&|\|\||[-+*/%^(),<>!?:]/g) || [];
    let i = 0;
    const peek = () => toks[i], eat = (t) => { if (toks[i] !== t) throw new Error("erwartet " + t); i++; };
    const BIN = { "||": 1, "&&": 2, "==": 3, "!=": 3, "<": 4, ">": 4, "<=": 4, ">=": 4, "+": 5, "-": 5, "*": 6, "/": 6, "%": 6, "^": 8 };
    function primary() {
      const t = toks[i++];
      if (t == null) throw new Error("Ende");
      if (/^\d/.test(t)) { const v = parseFloat(t); return () => v; }
      if (t === "(") { const e = expr(0); eat(")"); return e; }
      if (t === "-") { const e = unary(); return (s) => -e(s); }
      if (t === "+") return unary();
      if (t === "!") { const e = unary(); return (s) => (e(s) ? 0 : 1); }
      if (/^[A-Za-z_]/.test(t)) {
        if (peek() === "(") {
          i++; const args = [];
          if (peek() !== ")") { do { args.push(expr(0)); } while (peek() === "," && ++i); }
          eat(")");
          const f = FN[t] || FN[t.toLowerCase()];
          if (!f) throw new Error("Funktion " + t);
          return (s) => f(...args.map((a) => a(s)));
        }
        return (s) => (t in s ? s[t] : t in CONST ? CONST[t] : NaN);
      }
      throw new Error("Zeichen " + t);
    }
    function unary() { return primary(); }
    function expr(minP) {
      let left = unary();
      for (;;) {
        const op = peek();
        if (op === "?" && minP === 0) { i++; const a = expr(0); eat(":"); const b = expr(0); const c = left; left = (s) => (c(s) ? a(s) : b(s)); continue; }
        const p = BIN[op];
        if (!p || p < minP) break;
        i++;
        const right = expr(op === "^" ? p : p + 1), l = left;
        left = {
          "+": (s) => l(s) + right(s), "-": (s) => l(s) - right(s), "*": (s) => l(s) * right(s), "/": (s) => l(s) / right(s),
          "%": (s) => l(s) % right(s), "^": (s) => Math.pow(l(s), right(s)), "<": (s) => +(l(s) < right(s)), ">": (s) => +(l(s) > right(s)),
          "<=": (s) => +(l(s) <= right(s)), ">=": (s) => +(l(s) >= right(s)), "==": (s) => +(l(s) === right(s)), "!=": (s) => +(l(s) !== right(s)),
          "&&": (s) => +(l(s) && right(s)), "||": (s) => +(l(s) || right(s)),
        }[op];
      }
      return left;
    }
    const f = expr(0);
    if (i < toks.length) throw new Error("Rest " + toks.slice(i).join(""));
    return f;
  }
  function evaluator(src) {
    try { const f = compile(src); return (s) => { try { const v = f(s); return typeof v === "number" ? v : NaN; } catch (e) { return NaN; } }; }
    catch (e) { return () => NaN; }
  }

  // ---------- Bilder: URL, sonst Wikipedia / Wikimedia Commons nach Stichwort ----------
  const imgCache = new Map();
  async function json(url) { const r = await fetch(url); if (!r.ok) throw new Error(r.status); return r.json(); }
  async function findImage(q) {
    for (const lang of ["de", "en"]) {
      try {
        const j = await json("https://" + lang + ".wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(q.replace(/ /g, "_")));
        const src = (j.thumbnail && j.thumbnail.source) || (j.originalimage && j.originalimage.source);
        if (src && !/\.svg/i.test(src)) return src;
      } catch (e) { /* weiter */ }
    }
    try {
      const j = await json("https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=6&gsrsearch=" +
        encodeURIComponent(q + " filetype:bitmap") + "&prop=imageinfo&iiprop=url&iiurlwidth=480");
      const pages = Object.values((j.query && j.query.pages) || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
      for (const p of pages) { const ii = p.imageinfo && p.imageinfo[0]; if (ii && (ii.thumburl || ii.url)) return ii.thumburl || ii.url; }
    } catch (e) { /* nichts gefunden */ }
    return null;
  }
  function imageUrl(q, blob) {
    const key = (blob ? "b:" : "u:") + q;
    if (!imgCache.has(key)) {
      imgCache.set(key, (async () => {
        let url = /^https:\/\//i.test(q) ? q : await findImage(q);
        if (url && blob) { try { const r = await fetch(url); url = r.ok ? URL.createObjectURL(await r.blob()) : null; } catch (e) { url = null; } }
        return url;
      })().catch(() => null));
    }
    return imgCache.get(key);
  }
  function imageBox(item, ctx, cls) {
    const box = mk("div", "msui-img" + (cls ? " " + cls : ""));
    const q = typeof item === "string" ? item : item.image || item.bild || "";
    const icon = typeof item === "object" && (item.icon || item.emoji);
    const label = typeof item === "object" ? str(item.title || item.caption || item.name) : "";
    const fallback = () => { box.textContent = ""; if (icon) box.appendChild(mk("span", "", icon)); else if (label) box.appendChild(mk("span", "ini", label.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase())); };
    fallback();
    if (q && typeof q === "string") {
      imageUrl(q.trim(), ctx.blobImages).then((url) => {
        if (!url) return;
        const im = mk("img"); im.alt = label || q; im.loading = "lazy"; im.referrerPolicy = "no-referrer";
        im.onload = () => { box.textContent = ""; box.appendChild(im); };
        im.src = url;
      });
    }
    return box;
  }

  // ---------- Formeln (kleines TeX: ^ _ \frac \sqrt \cdot …) ----------
  const TEX = { "\\cdot": "·", "\\times": "×", "\\div": "÷", "\\pi": "π", "\\alpha": "α", "\\beta": "β", "\\gamma": "γ", "\\Delta": "Δ", "\\delta": "δ", "\\theta": "θ", "\\lambda": "λ", "\\mu": "μ", "\\sigma": "σ", "\\Sigma": "Σ", "\\omega": "ω", "\\infty": "∞", "\\le": "≤", "\\ge": "≥", "\\leq": "≤", "\\geq": "≥", "\\neq": "≠", "\\approx": "≈", "\\pm": "±", "\\rightarrow": "→", "\\to": "→", "\\sum": "∑", "\\int": "∫", "\\,": " ", "\\;": " ", "\\left": "", "\\right": "" };
  function tex(parent, s) {
    s = String(s || "").replace(/^\$+|\$+$/g, "");
    let i = 0;
    const group = () => {
      if (s[i] === "{") { let d = 0, j = i; for (; j < s.length; j++) { if (s[j] === "{") d++; else if (s[j] === "}" && --d === 0) break; } const g = s.slice(i + 1, j); i = j + 1; return g; }
      if (s[i] === "\\") { const m = /^\\[a-zA-Z]+/.exec(s.slice(i)); if (m) { i += m[0].length; return m[0]; } }
      return s[i++] || "";
    };
    let buf = "";
    const flush = () => { if (buf) { parent.appendChild(document.createTextNode(buf)); buf = ""; } };
    while (i < s.length) {
      const c = s[i];
      if (c === "^" || c === "_") { flush(); i++; tex(parent.appendChild(mk(c === "^" ? "sup" : "sub")), group()); continue; }
      if (c === "{" || c === "}") { i++; continue; }
      if (c === "\\") {
        const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i)); i += m[0].length;
        if (m[1] === "frac") { flush(); const a = group(), b = group(); parent.appendChild(document.createTextNode("(")); tex(parent, a); parent.appendChild(document.createTextNode(") ⁄ (")); tex(parent, b); parent.appendChild(document.createTextNode(")")); continue; }
        if (m[1] === "sqrt") { flush(); const g = group(); parent.appendChild(document.createTextNode("√")); const sp = mk("span"); sp.style.borderTop = "1px solid currentColor"; tex(sp, g); parent.appendChild(sp); continue; }
        if (m[1] === "text" || m[1] === "mathrm") { buf += group(); continue; }
        buf += TEX[m[0]] != null ? TEX[m[0]] : m[1]; continue;
      }
      buf += c; i++;
    }
    flush();
    return parent;
  }
  function formula(t) { return tex(mk("div", "msui-formula"), t); }

  // ---------- Diagramme (SVG) ----------
  function chart(spec) {
    const kind = String(spec.kind || spec.chart || "bar").toLowerCase();
    const labels = arr(spec.labels).map(str);
    let series = arr(spec.series).map((s, i) => ({ name: str(s.name || s.label), data: arr(s.data || s.values).map(Number), color: color(i, s.color) }));
    if (!series.length && spec.data) series = [{ name: str(spec.name), data: arr(spec.data).map((d) => Number(typeof d === "object" ? d.value : d)), color: color(0) }];
    if (!labels.length && Array.isArray(spec.data) && typeof spec.data[0] === "object") spec.data.forEach((d) => labels.push(str(d.label || d.name)));
    const wrap = mk("div");
    const W0 = 440, H0 = 230, pad = { l: 44, r: 8, t: 14, b: 30 };
    const unit = spec.format || spec.unit;
    const tip = (v) => fmt(v, spec.format, spec.unit);
    if (kind === "pie" || kind === "donut" || kind === "kreis") {
      const s0 = series[0] || { data: [] }, total = s0.data.reduce((a, b) => a + (b > 0 ? b : 0), 0) || 1;
      const sv = svg("svg", { viewBox: "0 0 440 220", width: "100%" });
      let a = -Math.PI / 2; const cx = 110, cy = 110, R = 95, r = kind === "pie" ? 0 : 55;
      s0.data.forEach((v, i) => {
        if (!(v > 0)) return;
        const b = a + (v / total) * Math.PI * 2, large = b - a > Math.PI ? 1 : 0;
        const p = (ang, rad) => (cx + rad * Math.cos(ang)).toFixed(2) + " " + (cy + rad * Math.sin(ang)).toFixed(2);
        const d = v >= total ? `M ${cx - R} ${cy} A ${R} ${R} 0 1 1 ${cx + R} ${cy} A ${R} ${R} 0 1 1 ${cx - R} ${cy}` :
          `M ${p(a, r || 0.01)} L ${p(a, R)} A ${R} ${R} 0 ${large} 1 ${p(b, R)} L ${p(b, r || 0.01)} ` + (r ? `A ${r} ${r} 0 ${large} 0 ${p(a, r)}` : "") + " Z";
        const path = svg("path", { d: d, fill: color(i), stroke: "rgba(0,0,0,.3)" });
        path.appendChild(svg("title")).textContent = (labels[i] || "") + ": " + tip(v) + " (" + Math.round((v / total) * 100) + " %)";
        sv.appendChild(path); a = b;
      });
      s0.data.forEach((v, i) => {
        const y = 24 + i * 22; if (y > 210) return;
        sv.appendChild(svg("rect", { x: 240, y: y - 10, width: 12, height: 12, rx: 3, fill: color(i) }));
        const t = svg("text", { x: 260, y: y + 1, fill: "currentColor", "font-size": 14 }); t.textContent = (labels[i] || "") + ": " + Math.round((v / total) * 100) + " %"; sv.appendChild(t);
      });
      wrap.appendChild(sv); return wrap;
    }
    const all = series.flatMap((s) => s.data).filter(isFinite);
    let max = Math.max(0, ...all), min = Math.min(0, ...all);
    if (max === min) max = min + 1;
    const step = niceStep((max - min) / 4); max = Math.ceil(max / step) * step; min = Math.floor(min / step) * step;
    const n = Math.max(labels.length, ...series.map((s) => s.data.length), 1);
    const iw = W0 - pad.l - pad.r, ih = H0 - pad.t - pad.b;
    const X = (i) => pad.l + (kind === "line" || kind === "area" ? (n === 1 ? iw / 2 : (i * iw) / (n - 1)) : ((i + 0.5) * iw) / n);
    const Y = (v) => pad.t + ih - ((v - min) / (max - min)) * ih;
    const sv = svg("svg", { viewBox: `0 0 ${W0} ${H0}`, width: "100%" });
    for (let v = min; v <= max + step / 2; v += step) {
      sv.appendChild(svg("line", { x1: pad.l, x2: W0 - pad.r, y1: Y(v), y2: Y(v), stroke: "currentColor", "stroke-opacity": v === 0 ? 0.35 : 0.1 }));
      const t = svg("text", { x: pad.l - 6, y: Y(v) + 4, "text-anchor": "end", "font-size": 12, fill: "currentColor", "fill-opacity": 0.6 }); t.textContent = short(v); sv.appendChild(t);
    }
    const every = Math.ceil(n / 10);
    labels.forEach((l, i) => { if (i % every) return; const t = svg("text", { x: X(i), y: H0 - 10, "text-anchor": "middle", "font-size": 12, fill: "currentColor", "fill-opacity": 0.7 }); t.textContent = l.length > 12 ? l.slice(0, 11) + "…" : l; sv.appendChild(t); });
    if (kind === "line" || kind === "area") {
      series.forEach((s) => {
        const pts = s.data.map((v, i) => X(i).toFixed(1) + "," + Y(v).toFixed(1));
        if (kind === "area") sv.appendChild(svg("polygon", { points: `${X(0)},${Y(Math.max(min, 0))} ${pts.join(" ")} ${X(s.data.length - 1)},${Y(Math.max(min, 0))}`, fill: s.color, "fill-opacity": 0.18 }));
        sv.appendChild(svg("polyline", { points: pts.join(" "), fill: "none", stroke: s.color, "stroke-width": 2.5, "stroke-linejoin": "round" }));
        if (s.data.length <= 40) s.data.forEach((v, i) => { const c = svg("circle", { cx: X(i), cy: Y(v), r: 3.5, fill: s.color }); c.appendChild(svg("title")).textContent = (labels[i] || "") + " " + s.name + ": " + tip(v); sv.appendChild(c); });
      });
    } else {
      const gw = (iw / n) * 0.72, bw = gw / Math.max(1, series.length);
      series.forEach((s, si) => s.data.forEach((v, i) => {
        if (!isFinite(v)) return;
        const x = X(i) - gw / 2 + si * bw, y0 = Y(Math.max(0, v)), h = Math.abs(Y(v) - Y(0));
        const r = svg("rect", { x: x + 1, y: y0, width: Math.max(1, bw - 2), height: Math.max(1, h), rx: 4, fill: s.color });
        r.appendChild(svg("title")).textContent = (labels[i] || "") + (s.name ? " – " + s.name : "") + ": " + tip(v);
        sv.appendChild(r);
        if (n * series.length <= 8) { const t = svg("text", { x: x + bw / 2, y: y0 - 4, "text-anchor": "middle", "font-size": 12, fill: "currentColor" }); t.textContent = short(v); sv.appendChild(t); }
      }));
    }
    wrap.appendChild(sv);
    if (series.length > 1 || (series[0] && series[0].name)) {
      const lg = mk("div", "msui-legend");
      series.forEach((s) => { const sp = mk("span"); const ii = mk("i"); ii.style.background = s.color; sp.append(ii, document.createTextNode(s.name)); lg.appendChild(sp); });
      wrap.appendChild(lg);
    }
    void unit;
    return wrap;
  }
  function niceStep(x) { if (!(x > 0)) return 1; const p = Math.pow(10, Math.floor(Math.log10(x))), f = x / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }
  function short(v) { const a = Math.abs(v); return a >= 1e6 ? (v / 1e6).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " Mio" : a >= 1e4 ? (v / 1e3).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + "k" : v.toLocaleString("de-DE", { maximumFractionDigits: 2 }); }

  // ---------- Sichere SVG-Vorlage mit {{Ausdruck}} (für Rechner-Grafiken) ----------
  const SVG_TAGS = /^(svg|g|rect|circle|ellipse|line|polyline|polygon|path|text|tspan|title|defs|lineargradient|radialgradient|stop|marker)$/i;
  function safeSvg(tpl, scope) {
    const filled = String(tpl).replace(/\{\{([^}]+)\}\}/g, (_, e) => { const v = evaluator(e)(scope); return isFinite(v) ? String(Math.round(v * 100) / 100) : "0"; });
    let doc;
    const src = /<svg[^>]*\sxmlns=/i.test(filled) ? filled : filled.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    try { doc = new DOMParser().parseFromString(src, "image/svg+xml"); } catch (e) { return null; }
    const root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() !== "svg" || doc.getElementsByTagName("parsererror").length) return null;
    const clean = (node) => {
      [...node.children].forEach((c) => { if (!SVG_TAGS.test(c.nodeName)) c.remove(); else clean(c); });
      [...node.attributes].forEach((a) => { if (/^on|href$/i.test(a.name) || /javascript:|url\(\s*['"]?(?!#)/i.test(a.value)) node.removeAttribute(a.name); });
    };
    clean(root);
    const out = document.importNode(root, true);
    if (!out.getAttribute("width")) out.setAttribute("width", "100%");
    out.setAttribute("style", "max-height:260px");
    return out;
  }

  // ---------- Bausteine ----------
  const B = {};
  function head(box, s, ctx) {
    if (s.title) box.appendChild(mk("div", "msui-h", s.title));
    if (s.subtitle || s.description) box.appendChild(rich(mk("div", "msui-sub"), s.subtitle || s.description));
    void ctx;
  }
  function note(box, s) { if (s.note || s.hint) box.appendChild(rich(mk("div", "msui-mut"), s.note || s.hint)).style.marginTop = "8px"; }

  B.cards = (s, ctx) => {
    const box = mk("div", "msui-box"); head(box, s, ctx);
    const items = arr(s.items || s.cards);
    const row = s.layout === "row" || s.layout === "list" || (items.length && items.every((it) => it.text && String(it.text).length > 70));
    const grid = mk("div", row ? "" : "msui-cards"); if (row) { grid.style.display = "flex"; grid.style.flexDirection = "column"; grid.style.gap = "10px"; }
    items.forEach((it) => {
      if (typeof it === "string") it = { title: it };
      const c = mk("div", "msui-card" + (row ? " row" : ""));
      if (it.image || it.bild || it.icon || it.emoji || !row) c.appendChild(imageBox(it, ctx));
      const inn = mk("div", "in");
      if (it.title || it.name) inn.appendChild(mk("div", "t", it.title || it.name));
      if (it.subtitle) inn.appendChild(mk("div", "s", it.subtitle));
      if (it.text) inn.appendChild(rich(mk("div", "x"), it.text));
      if (it.value != null) inn.appendChild(mk("div", "t", it.value));
      if (it.badges || it.tags) { const bd = mk("div", "msui-badges"); arr(it.badges || it.tags).forEach((b) => bd.appendChild(mk("span", "msui-badge", str(b)))); inn.appendChild(bd); }
      if (it.link && /^https?:\/\//i.test(it.link)) { const l = mk("button", "msui-btn", "Öffnen ↗"); l.style.alignSelf = "flex-start"; l.style.marginTop = "4px"; l.onclick = () => ctx.openLink(it.link); inn.appendChild(l); }
      if (it.prompt) { const l = mk("button", "msui-btn", it.action || "Mehr dazu"); l.style.alignSelf = "flex-start"; l.style.marginTop = "4px"; l.onclick = () => ctx.send(it.prompt); inn.appendChild(l); }
      c.appendChild(inn); grid.appendChild(c);
    });
    box.appendChild(grid); note(box, s); return box;
  };

  function choiceInto(box, s) {
    const opts = arr(s.options || s.criteria || s.tabs);
    if (s.label || s.question) box.appendChild(mk("div", "", s.label || s.question)).style.fontWeight = "600";
    const list = mk("div", "msui-opts"), pane = mk("div", "msui-pane");
    const ckey = "c-" + hash(JSON.stringify([s.title, s.label, s.question, opts.map((o) => (typeof o === "object" ? o.label || o.title : o))]));
    let cur = Math.min(opts.length - 1, Math.max(0, mem.has(ckey) ? mem.get(ckey) : s.selected | 0));
    const draw = () => {
      [...list.children].forEach((b, i) => b.classList.toggle("on", i === cur));
      pane.textContent = ""; const o = opts[cur]; if (!o) return;
      if (typeof o === "object") { pane.appendChild(mk("div", "pt", o.title || o.label)); if (o.text) rich(pane.appendChild(mk("div")), o.text); if (o.image) { const im = imageBox(o, box._ctx); im.style.marginTop = "8px"; im.style.borderRadius = "12px"; pane.appendChild(im); } }
      else rich(pane, o);
    };
    opts.forEach((o, i) => { const b = mk("button", "msui-opt"); b.type = "button"; b.append(mk("span", "msui-radio"), mk("span", "", typeof o === "object" ? o.label || o.title || o.text || "" : String(o))); b.onclick = () => { cur = i; mem.set(ckey, i); draw(); }; list.appendChild(b); });
    box.append(list, pane); draw();
  }
  B.choice = (s, ctx) => { const box = mk("div", "msui-box"); box._ctx = ctx; head(box, s, ctx); choiceInto(box, s); note(box, s); return box; };
  B.tabs = B.choice;
  B.compare = (s, ctx) => {
    const box = mk("div", "msui-box"); box._ctx = ctx; head(box, s, ctx);
    const grid = mk("div", "msui-cards");
    arr(s.items).forEach((it) => { if (typeof it === "string") it = { title: it }; const c = mk("div", "msui-card"); c.appendChild(imageBox(it, ctx)); const inn = mk("div", "in"); inn.appendChild(mk("div", "t", it.title || it.name)); if (it.subtitle) inn.appendChild(mk("div", "s", it.subtitle)); c.appendChild(inn); grid.appendChild(c); });
    box.appendChild(grid);
    if (arr(s.criteria || s.options).length) { const sp = mk("div"); sp.style.marginTop = "12px"; sp._ctx = ctx; box.appendChild(sp); choiceInto(sp, Object.assign({}, s, { label: s.label || "Kriterium auswählen" })); }
    note(box, s); return box;
  };

  B.calculator = (s, ctx) => {
    const box = mk("div", "msui-box"); head(box, s, ctx);
    if (s.formula) box.appendChild(formula(s.formula));
    const scope = {}, inputs = arr(s.inputs || s.sliders), outputs = arr(s.outputs || s.results);
    const outEls = [];
    const res = mk("div", "msui-result"), vis = mk("div", "msui-visual"), ch = mk("div");
    const recompute = () => {
      outputs.forEach((o, i) => { const v = o._f(scope); if (o.id) scope[o.id] = v; outEls[i].textContent = fmt(v, o.format, o.unit, o.decimals); });
      if (s.svg) { const el = safeSvg(s.svg, scope); vis.textContent = ""; if (el) vis.appendChild(el); }
      if (s.chart) {
        const c = s.chart, x = c.x || "x", from = +evaluator(String(c.from != null ? c.from : 0))(scope), to = +evaluator(String(c.to != null ? c.to : 10))(scope);
        const steps = Math.max(1, Math.min(60, Math.round(to - from) || 10)), labels = [], ser = arr(c.y || c.series).map((y) => ({ name: str(y.label || y.name), data: [], f: evaluator(y.expr || y.formula || y) }));
        for (let k = 0; k <= steps; k++) { const xv = from + ((to - from) * k) / steps; labels.push(short(Math.round(xv * 100) / 100)); const sc = Object.assign({}, scope, { [x]: xv }); ser.forEach((y) => y.data.push(y.f(sc))); }
        ch.textContent = ""; ch.appendChild(chart({ kind: c.kind || "line", labels, series: ser, format: c.format }));
      }
    };
    inputs.forEach((inp) => {
      const id = inp.id || inp.name || "x", min = +(inp.min != null ? inp.min : 0), max = +(inp.max != null ? inp.max : 100);
      const step = +(inp.step || (max - min < 5 ? 0.1 : 1));
      scope[id] = +(inp.value != null ? inp.value : inp.default != null ? inp.default : min);
      const f = mk("div", "msui-field"), lab = mk("div", "msui-fl"), val = mk("b");
      lab.append(mk("span", "", inp.label || id), val); f.appendChild(lab);
      const show = () => (val.textContent = fmt(scope[id], inp.format, inp.unit, inp.decimals));
      if (inp.type === "number") {
        const n = mk("input", "msui-num"); n.type = "number"; n.value = scope[id]; n.step = step;
        n.oninput = () => { scope[id] = +n.value || 0; show(); recompute(); }; f.appendChild(n);
      } else {
        const r = mk("input"); r.type = "range"; r.min = min; r.max = max; r.step = step; r.value = scope[id];
        r.oninput = () => { scope[id] = +r.value; show(); recompute(); };
        const sc = mk("div", "msui-scale"); sc.append(mk("span", "", fmt(min, inp.format, inp.unit)), mk("span", "", fmt((min + max) / 2, inp.format, inp.unit)), mk("span", "", fmt(max, inp.format, inp.unit)));
        f.append(r, sc);
      }
      show(); box.appendChild(f);
    });
    outputs.forEach((o, i) => {
      o._f = evaluator(o.expr || o.formula || o.value || "0");
      const v = mk(o.big || i === 0 ? "div" : "b", o.big || i === 0 ? "msui-big" : "");
      if (o.big || i === 0) { res.append(mk("div", "msui-mut", o.label || ""), v); }
      else { const kv = mk("div", "msui-kv"); kv.append(mk("span", "", o.label || o.id || ""), v); res.appendChild(kv); }
      outEls.push(v);
    });
    if (s.svg) box.appendChild(vis);
    if (outputs.length) box.appendChild(res);
    if (s.chart) box.appendChild(ch);
    recompute(); note(box, s); return box;
  };
  B.rechner = B.calculator;

  B.chart = (s, ctx) => { const box = mk("div", "msui-box"); head(box, s, ctx); box.appendChild(chart(s)); note(box, s); return box; };
  B.formula = (s, ctx) => { const box = mk("div", "msui-box"); head(box, s, ctx); box.appendChild(formula(s.tex || s.formula || s.text)); note(box, s); return box; };

  B.stats = (s, ctx) => {
    const box = mk("div", "msui-box"); head(box, s, ctx);
    const g = mk("div", "msui-stats");
    arr(s.items).forEach((it) => { const c = mk("div", "msui-stat"); c.append(mk("div", "msui-mut", it.label || ""), mk("div", "v", it.value != null ? it.value : "")); if (it.hint || it.change) c.appendChild(mk("div", "msui-mut", it.hint || it.change)); g.appendChild(c); });
    box.appendChild(g); note(box, s); return box;
  };

  B.steps = (s, ctx) => {
    const box = mk("div", "msui-box"); head(box, s, ctx);
    const items = arr(s.items || s.steps), w = mk("div", "msui-steps");
    items.forEach((it, i) => {
      if (typeof it === "string") it = { title: it };
      if (i) w.appendChild(mk("div", "msui-arrow", "↓"));
      const c = mk("div", "msui-step" + (i === items.length - 1 && items.length > 2 ? " last" : ""));
      if (it.icon) c.appendChild(mk("div", "i", it.icon));
      c.appendChild(mk("div", "t", (s.numbered === false ? "" : i + 1 + ". ") + (it.title || "")));
      if (it.text) c.appendChild(rich(mk("div", "x"), it.text));
      w.appendChild(c);
    });
    box.appendChild(w); note(box, s); return box;
  };
  B.flow = B.steps;

  B.timeline = (s, ctx) => {
    const box = mk("div", "msui-box"); head(box, s, ctx);
    const w = mk("div", "msui-tl");
    arr(s.items || s.events).forEach((it) => {
      if (typeof it === "string") it = { title: it };
      const r = mk("div", "msui-tli"), body = mk("div");
      r.append(mk("div", "tm", it.time || it.date || ""), mk("div", "dot"), body);
      body.appendChild(mk("div", "", it.title || "")).style.fontWeight = "600";
      if (it.text) body.appendChild(rich(mk("div", "msui-mut"), it.text));
      w.appendChild(r);
    });
    box.appendChild(w); note(box, s); return box;
  };

  const store = { get: (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* egal */ } } };
  // Zwischenstand von Bedienelementen (gewählter Tab, angeklickte Optionen): überlebt jedes Neuzeichnen des Chats.
  const mem = new Map();
  const hash = (t) => { let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  B.checklist = (s, ctx) => {
    if (ctx.pinChecklists) {
      const items = arr(s.items), done = items.filter((it) => it && it.done).length;
      return mk("div", "msui-pinref", "☑ " + (s.title || "Checkliste") + " · " + done + "/" + items.length + " – unten angeheftet");
    }
    const box = mk("div", "msui-box"); head(box, s, ctx);
    const items = arr(s.items).map((it) => (typeof it === "string" ? { text: it } : it));
    const key = "msui-check-" + hash(JSON.stringify(items));
    const done = store.get(key) || items.map((it) => !!it.done);
    const prog = mk("div", "msui-mut");
    const upd = () => (prog.textContent = done.filter(Boolean).length + " von " + items.length + " erledigt");
    items.forEach((it, i) => {
      const r = mk("div", "msui-check" + (done[i] ? " on" : "")), cb = mk("span", "msui-cb", done[i] ? "✓" : ""), t = rich(mk("span", "ct"), it.text || it.title || "");
      r.append(cb, t); r.onclick = () => { done[i] = !done[i]; r.classList.toggle("on", done[i]); cb.textContent = done[i] ? "✓" : ""; store.set(key, done); upd(); };
      box.appendChild(r);
    });
    upd(); box.appendChild(prog); note(box, s); return box;
  };
  B.todo = B.checklist;

  // Rückfrage mit Auswahl (+ eigene Antwort) – „Abschicken“ schickt die Antwort als Nachricht an Mythos.
  // {"type":"question","id":"stil","question":"Welcher Stil?","options":["A",{"label":"B","text":"Erklärung"}],"multi":false,"other":true}
  B.question = (s, ctx) => {
    const box = mk("div", "msui-box");
    const q = s.question || s.title || s.frage || "Frage";
    const key = "msui-q-" + hash(JSON.stringify([q, s.options, s.id]));
    box.appendChild(mk("div", "msui-h", q));
    if (s.description || s.subtitle) box.appendChild(mk("div", "msui-sub", s.description || s.subtitle));
    const answered = store.get(key);
    if (answered) { const d = mk("div", "msui-q-done"); d.append(mk("span", "", "✓"), mk("span", "", "Beantwortet: " + answered)); box.appendChild(d); return box; }
    const opts = arr(s.options).map((o) => (o && typeof o === "object" ? { label: String(o.label || o.title || o.text || ""), text: o.label || o.title ? o.text || o.description || "" : o.description || "" } : { label: String(o), text: "" }));
    const multi = !!(s.multi || s.multiple);
    const draft = mem.get(key) || { sel: [], other: "" }; mem.set(key, draft);
    const sel = new Set(draft.sel);
    const send = mk("button", "msui-q-send", s.submit || "Abschicken"); send.type = "button";
    let other = null;
    const upd = () => { send.disabled = !sel.size && !(other && other.value.trim()); draft.sel = [...sel]; draft.other = other ? other.value : ""; };
    opts.forEach((o, i) => {
      const b = mk("button", "msui-q-opt"); b.type = "button";
      const k = mk("span", "k", ""); const t = mk("span", ""); t.appendChild(mk("span", "", o.label)); if (o.text) t.appendChild(mk("span", "d", o.text));
      b.append(k, t);
      b.onclick = () => {
        if (!multi) { sel.clear(); box.querySelectorAll(".msui-q-opt").forEach((x) => { x.classList.remove("on"); x.firstChild.textContent = ""; }); }
        if (sel.has(i)) sel.delete(i); else sel.add(i);
        b.classList.toggle("on", sel.has(i)); k.textContent = sel.has(i) ? "✓" : "";
        upd();
      };
      if (sel.has(i)) { b.classList.add("on"); k.textContent = "✓"; }
      box.appendChild(b);
    });
    if (s.other !== false) {
      other = mk("input", "msui-q-other"); other.placeholder = s.otherLabel || (opts.length ? "Oder eigene Antwort…" : "Deine Antwort…");
      other.value = draft.other || "";
      other.oninput = upd; other.onkeydown = (e) => { if (e.key === "Enter" && !send.disabled) send.click(); };
      box.appendChild(other);
    }
    send.onclick = () => {
      const picked = [...sel].sort((a, b) => a - b).map((i) => opts[i].label);
      const own = other && other.value.trim();
      if (own) picked.push(own);
      if (!picked.length) return;
      const answer = picked.join(", ");
      store.set(key, answer); mem.delete(key);
      ctx.send("Antwort auf „" + q + "“: " + answer);
      box.replaceChildren(mk("div", "msui-h", q));
      const d = mk("div", "msui-q-done"); d.append(mk("span", "", "✓"), mk("span", "", "Beantwortet: " + answer)); box.appendChild(d);
    };
    upd();
    box.appendChild(send);
    return box;
  };
  B.frage = B.question;

  B.quiz = (s, ctx) => {
    const box = mk("div", "msui-box"); head(box, Object.assign({}, s, { title: s.title || "Quiz" }), ctx);
    const qs = s.questions ? arr(s.questions) : [s];
    // Antworten bleiben gespeichert (auch nach Neuzeichnen, Chat-Wechsel und Neuladen).
    const key = "msui-quiz-" + hash(JSON.stringify([s.title, s.id, qs.map((q) => [q.question || q.frage, q.options])]));
    let picks = store.get(key); if (!picks || typeof picks !== "object") picks = {};
    const ansOf = (q) => (typeof q.answer === "number" ? q.answer : arr(q.options).map(str).indexOf(str(q.answer)));
    const score = mk("div", "msui-mut"), foot = mk("div", "msui-btns");
    const marks = [];
    const total = () => {
      const done = qs.filter((_, i) => picks[i] != null).length, right = qs.filter((q, i) => picks[i] === ansOf(q)).length;
      if (qs.length > 1) score.textContent = done ? right + " von " + done + " richtig" + (done === qs.length ? " – fertig!" : "") : "";
      foot.textContent = "";
      if (done) {
        if (done === qs.length) {
          const send = mk("button", "msui-btn", s.sendLabel || "Ergebnis an Mythos schicken"); send.type = "button";
          send.onclick = () => {
            const wrong = qs.map((q, i) => (picks[i] !== ansOf(q) ? "„" + str(q.question || q.frage || "") + "“ (meine Antwort: " + str(arr(q.options)[picks[i]]) + ")" : "")).filter(Boolean);
            ctx.send("Quiz-Ergebnis" + (s.title ? " „" + s.title + "“" : "") + ": " + right + " von " + qs.length + " richtig." + (wrong.length ? " Falsch beantwortet: " + wrong.join("; ") + ". Erklär mir kurz, was ich da falsch verstanden habe, und stell mir dazu eine neue Frage." : " Alles richtig – gib mir schwierigere Fragen."));
          };
          foot.appendChild(send);
        }
        const again = mk("button", "msui-btn", "Nochmal"); again.type = "button";
        again.onclick = () => { picks = {}; store.set(key, picks); marks.forEach((m) => m(true)); total(); };
        foot.appendChild(again);
      }
    };
    qs.forEach((q, qi) => {
      const w = mk("div"); if (qi) w.style.marginTop = "14px";
      rich(w.appendChild(mk("div")), q.question || q.frage || "").parentNode.lastChild.style.fontWeight = "600";
      const bs = mk("div", "msui-btns"); bs.style.marginTop = "8px";
      const ex = mk("div", "msui-mut"); ex.style.marginTop = "6px";
      const ans = ansOf(q);
      const mark = (reset) => {
        const i = picks[qi];
        [...bs.children].forEach((x, j) => { x.classList.toggle("ok", !reset && i != null && j === ans); x.classList.toggle("bad", !reset && i != null && j === i && i !== ans); x.disabled = !reset && i != null; });
        ex.textContent = "";
        if (!reset && i != null) rich(ex, (i === ans ? "✓ Richtig. " : "✗ Leider falsch. ") + (q.explanation || q.erklaerung || (i === ans ? "" : "Richtig wäre: " + str(arr(q.options)[ans]))));
      };
      marks.push(mark);
      arr(q.options).forEach((o, i) => {
        const b = mk("button", "msui-btn", str(o)); b.type = "button";
        b.onclick = () => { if (picks[qi] != null) return; picks[qi] = i; store.set(key, picks); mark(false); total(); };
        bs.appendChild(b);
      });
      w.append(bs, ex); box.appendChild(w);
      mark(false);
    });
    score.style.marginTop = "10px"; foot.style.marginTop = "8px";
    box.append(score, foot); total();
    return box;
  };

  B.buttons = (s, ctx) => {
    const box = mk("div"); if (s.title) box.appendChild(mk("div", "msui-mut", s.title)).style.marginBottom = "6px";
    const bs = mk("div", "msui-btns");
    arr(s.items || s.buttons || s.actions).forEach((it) => {
      if (typeof it === "string") it = { label: it, prompt: it };
      const b = mk("button", "msui-btn", (it.icon ? it.icon + " " : "") + (it.label || it.prompt)); b.type = "button";
      b.onclick = () => (it.url && /^https?:\/\//i.test(it.url) ? ctx.openLink(it.url) : ctx.send(it.prompt || it.label));
      bs.appendChild(b);
    });
    box.appendChild(bs); return box;
  };
  B.actions = B.buttons; B.suggestions = B.buttons;

  B.prompt = (s, ctx) => {
    const box = mk("div", "msui-box"); head(box, s, ctx);
    const text = s.text || s.prompt || "";
    rich(box.appendChild(mk("div", "msui-quote")), "„" + text + "“");
    const row = mk("div", "msui-btns"); row.style.marginTop = "10px";
    const cp = mk("button", "msui-btn", "⧉ Prompt kopieren"); cp.onclick = () => { ctx.copy(text); cp.textContent = "✓ Kopiert"; setTimeout(() => (cp.textContent = "⧉ Prompt kopieren"), 1500); };
    const go = mk("button", "msui-btn", "➤ Ausprobieren"); go.onclick = () => ctx.send(text);
    row.append(cp, go); box.appendChild(row); return box;
  };

  B.map = (s, ctx) => {
    const box = mk("div", "msui-box"); head(box, s, ctx);
    const places = arr(s.places || s.stops || s.items).map((p) => (typeof p === "string" ? { name: p } : p));
    const frame = mk("iframe", "msui-map"); frame.title = "Karte"; frame.setAttribute("loading", "lazy");
    box.appendChild(frame);
    const geo = (p) => (p.lat != null && p.lon != null ? Promise.resolve([+p.lat, +p.lon]) :
      fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(p.address || p.name)).then((r) => r.json()).then((j) => (j[0] ? [+j[0].lat, +j[0].lon] : null)).catch(() => null));
    Promise.all(places.slice(0, 12).map(geo)).then((pts) => {
      const ok = pts.filter(Boolean);
      if (!ok.length) { frame.remove(); return; }
      let [a, b, c, d] = [Math.min(...ok.map((p) => p[0])), Math.min(...ok.map((p) => p[1])), Math.max(...ok.map((p) => p[0])), Math.max(...ok.map((p) => p[1]))];
      const m = Math.max(0.01, (c - a) * 0.2, (d - b) * 0.2); a -= m; c += m; b -= m; d += m;
      frame.src = "https://www.openstreetmap.org/export/embed.html?bbox=" + [b, a, d, c].map((x) => x.toFixed(5)).join(",") + "&layer=mapnik&marker=" + ok[0][0] + "," + ok[0][1];
    });
    const list = mk("div", "msui-tl");
    places.forEach((p, i) => {
      const r = mk("div", "msui-tli"), body = mk("div");
      r.append(mk("div", "tm", p.time || String.fromCharCode(65 + i)), mk("div", "dot"), body);
      body.appendChild(mk("div", "", p.name || "")).style.fontWeight = "600";
      if (p.text || p.note) body.appendChild(rich(mk("div", "msui-mut"), p.text || p.note));
      list.appendChild(r);
    });
    box.appendChild(list);
    if (places.length) {
      const enc = (p) => encodeURIComponent(p.lat != null ? p.lat + "," + p.lon : p.address || p.name);
      const url = places.length === 1 ? "https://www.google.com/maps/search/?api=1&query=" + enc(places[0]) :
        "https://www.google.com/maps/dir/?api=1&origin=" + enc(places[0]) + "&destination=" + enc(places[places.length - 1]) +
        (places.length > 2 ? "&waypoints=" + places.slice(1, -1).map(enc).join("%7C") : "") + "&travelmode=" + (s.mode || "driving");
      const b = mk("button", "msui-btn wide", places.length === 1 ? "📍 In Google Maps öffnen" : "🧭 Route in Google Maps öffnen"); b.onclick = () => ctx.openLink(url);
      box.appendChild(b);
    }
    note(box, s); return box;
  };
  B.karte = B.map; B.route = B.map;

  B.gallery = (s, ctx) => {
    const box = mk("div", "msui-box"); head(box, s, ctx);
    const g = mk("div", "msui-gal");
    arr(s.items || s.images).forEach((it) => {
      if (typeof it === "string") it = { image: it };
      const f = mk("figure"); f.appendChild(imageBox(it, ctx)); if (it.caption || it.title) f.appendChild(mk("figcaption", "", it.caption || it.title)); g.appendChild(f);
    });
    box.appendChild(g); note(box, s); return box;
  };
  B.images = B.gallery; B.bilder = B.gallery;
  B.image = (s, ctx) => { const box = mk("div", "msui-box"); head(box, s, ctx); const im = imageBox(s, ctx); im.style.borderRadius = "12px"; im.style.aspectRatio = "16/9"; box.appendChild(im); if (s.caption) box.appendChild(mk("div", "msui-mut", s.caption)).style.marginTop = "6px"; return box; };

  B.table = (s, ctx) => {
    const box = mk("div", "msui-box"); head(box, s, ctx);
    const cols = arr(s.columns || s.headers).map(str);
    let rows = arr(s.rows).map((r) => (Array.isArray(r) ? r : cols.map((c) => r[c])));
    const wrap = mk("div", "msui-scroll"), t = mk("table", "msui-table");
    let sortCol = -1, asc = true;
    const draw = () => {
      t.textContent = ""; const hr = mk("tr");
      cols.forEach((c, i) => { const th = mk("th", "", c + (i === sortCol ? (asc ? " ↑" : " ↓") : "")); th.onclick = () => { asc = sortCol === i ? !asc : true; sortCol = i; const num = (x) => parseFloat(String(x).replace(/\./g, "").replace(",", ".")); rows = rows.slice().sort((a, b) => { const x = a[i], y = b[i], nx = num(x), ny = num(y); const r = !isNaN(nx) && !isNaN(ny) ? nx - ny : String(x).localeCompare(String(y), "de"); return asc ? r : -r; }); draw(); }; hr.appendChild(th); });
      t.appendChild(hr);
      rows.forEach((r) => { const tr = mk("tr"); r.forEach((c) => rich(tr.appendChild(mk("td")), str(c))); t.appendChild(tr); });
    };
    draw(); wrap.appendChild(t); box.appendChild(wrap); note(box, s); return box;
  };
  B.text = (s) => rich(mk("div"), s.text || "");

  // ---------- Einstieg ----------
  function parse(raw) {
    const t = String(raw || "").trim();
    if (!t) return null;
    try { return JSON.parse(t); } catch (e) { /* evtl. Kommentare/Kommas */ }
    try { return JSON.parse(t.replace(/^\s*\/\/.*$/gm, "").replace(/,\s*([}\]])/g, "$1")); } catch (e) { return null; }
  }
  function render(raw, opts) {
    ensureCss();
    const o = opts || {};
    const ctx = {
      send: o.send || (() => {}),
      openLink: o.openLink || ((u) => { try { window.open(u, "_blank", "noopener"); } catch (e) { /* egal */ } }),
      copy: o.copy || ((t) => { try { navigator.clipboard.writeText(t); } catch (e) { /* egal */ } }),
      blobImages: !!o.blobImages,
      pinChecklists: !!o.pinChecklists,
    };
    const root = mk("div", "msui");
    const spec = typeof raw === "string" ? parse(raw) : raw;
    if (!spec) { root.appendChild(mk("div", "msui-wait", o.streaming === false ? "Diese Oberfläche konnte nicht angezeigt werden." : "Oberfläche wird gebaut…")); return root; }
    const blocks = Array.isArray(spec) ? spec : spec.blocks ? (spec.title ? [{ type: "text", text: "**" + spec.title + "**" }] : []).concat(spec.blocks) : [spec];
    blocks.forEach((b) => {
      if (!b || typeof b !== "object") return;
      const fn = B[String(b.type || b.kind || "").toLowerCase()] || (b.inputs ? B.calculator : b.options ? B.choice : b.places ? B.map : b.items ? B.cards : null);
      if (!fn) return;
      try { root.appendChild(fn(b, ctx)); } catch (e) { root.appendChild(mk("div", "msui-mut", "(Baustein „" + (b.type || "?") + "“ fehlerhaft)")); }
    });
    return root;
  }

  const PROMPT =
    "## Intelligente Oberfläche (wie ChatGPT Intelligent UI)\n" +
    "Wenn eine Antwort durch Bedienelemente klarer oder nützlicher wird, baue sie direkt in den Chat ein – zusätzlich zu einem kurzen Text. " +
    "Schreibe dazu einen Codeblock mit der Sprache mythos-ui und gültigem JSON (nur doppelte Anführungszeichen, keine Kommentare):\n" +
    "```mythos-ui\n{\"type\":\"…\", …}\n```\n" +
    "Mehrere Bausteine: {\"blocks\":[{…},{…}]}. Nutze das NUR, wenn es echten Mehrwert bringt (Vergleiche, Rechnungen, Lernen, Planen, Zahlen, Auswahl). " +
    "Einfache Fragen und Smalltalk bleiben normaler Text. Erfinde keine Zahlen/Statistiken; kennzeichne Schätzungen.\n" +
    "Bausteine:\n" +
    "- cards: {\"type\":\"cards\",\"title\":\"…\",\"items\":[{\"title\":\"…\",\"subtitle\":\"…\",\"text\":\"…\",\"image\":\"Wikipedia-Titel oder https-Bild-URL\",\"icon\":\"🎯\",\"badges\":[\"…\"],\"prompt\":\"Folgefrage bei Klick\"}]} – image als Stichwort (z. B. \"Kylian Mbappé\", \"Eiffelturm\") lädt automatisch ein passendes Foto.\n" +
    "- compare: {\"type\":\"compare\",\"title\":\"Spielervergleich\",\"items\":[{\"title\":\"A\",\"subtitle\":\"…\",\"image\":\"…\"},{…}],\"label\":\"Vergleichskriterium auswählen\",\"criteria\":[{\"label\":\"Tempo\",\"text\":\"Bewertung …\"}],\"note\":\"…\"}\n" +
    "- choice: {\"type\":\"choice\",\"title\":\"…\",\"label\":\"…\",\"options\":[{\"label\":\"…\",\"text\":\"…\"}]} – Auswahl, Inhalt wechselt beim Klicken.\n" +
    "- calculator: {\"type\":\"calculator\",\"title\":\"Sparrechner\",\"description\":\"Probiere die Regler aus.\",\"formula\":\"TeX optional\",\"inputs\":[{\"id\":\"rate\",\"label\":\"Monatlicher Sparbetrag\",\"min\":0,\"max\":200,\"step\":5,\"value\":50,\"format\":\"eur\"}]," +
    "\"outputs\":[{\"id\":\"total\",\"label\":\"Guthaben\",\"expr\":\"start + rate*n\",\"format\":\"eur\"},{\"label\":\"Einzahlungen\",\"expr\":\"rate*n\",\"format\":\"eur\"}],\"chart\":{\"x\":\"m\",\"from\":0,\"to\":\"n\",\"y\":[{\"label\":\"Guthaben\",\"expr\":\"start+rate*m\"}]},\"svg\":\"<svg viewBox='0 0 200 120'>…{{a*10}}…</svg>\",\"note\":\"Vereinfachte Rechnung …\"} " +
    "– Regler rechnen live. expr: + - * / ^ %, Klammern, sqrt, round(x,2), min, max, pow, abs, log, ln, exp, sin, cos, pi, if(bed,a,b), Vergleiche; Variablen = Input-ids und vorherige Output-ids. " +
    "format: eur, percent, int oder unit:\"km\". Erste Ausgabe wird groß angezeigt. svg (optional) ist eine Live-Skizze; {{Ausdruck}} wird eingesetzt (z. B. Dreieck für Pythagoras), nur einfache Formen und text.\n" +
    "- chart: {\"type\":\"chart\",\"kind\":\"bar|line|area|pie|donut\",\"title\":\"…\",\"labels\":[\"Jan\",\"Feb\"],\"series\":[{\"name\":\"Ausgaben\",\"data\":[120,90]}],\"format\":\"eur\"}\n" +
    "- stats: {\"type\":\"stats\",\"items\":[{\"label\":\"…\",\"value\":\"12,4 %\",\"hint\":\"…\"}]}\n" +
    "- formula: {\"type\":\"formula\",\"title\":\"…\",\"tex\":\"a^2 + b^2 = c^2\"}\n" +
    "- table: {\"type\":\"table\",\"columns\":[\"…\"],\"rows\":[[\"…\"]]} – sortierbar.\n" +
    "- steps: {\"type\":\"steps\",\"items\":[{\"icon\":\"💬\",\"title\":\"…\",\"text\":\"…\"}]} – Ablauf mit Pfeilen.\n" +
    "- timeline: {\"type\":\"timeline\",\"items\":[{\"time\":\"09:00\",\"title\":\"…\",\"text\":\"…\"}]} – Zeitplan/Tagesplan.\n" +
    "- map: {\"type\":\"map\",\"title\":\"…\",\"places\":[{\"name\":\"Ort, Stadt\",\"lat\":48.1,\"lon\":11.5,\"time\":\"10:00\",\"text\":\"…\"}],\"mode\":\"driving|walking|transit\"} – Karte + Route (lat/lon wenn sicher bekannt).\n" +
    "- checklist: {\"type\":\"checklist\",\"id\":\"plan\",\"title\":\"…\",\"items\":[{\"text\":\"…\",\"done\":false}]} – Plan/Aufgabenliste, wird unten über dem Eingabefeld angeheftet. " +
    "Pro Aufgabe nur EINE Liste mit fester id; Fortschritt = dieselbe Liste (gleiche id, gleiche Punkte) mit \"done\":true neu schicken, nicht eine neue Liste anfangen.\n" +
    "- question: {\"type\":\"question\",\"question\":\"Welcher Stil?\",\"options\":[\"Modern\",{\"label\":\"Retro\",\"text\":\"Pixel-Look\"}],\"multi\":false} – Rückfrage zum Anklicken mit „Abschicken“; " +
    "die Antwort kommt als Nachricht „Antwort auf …“ zu dir zurück. Nutze das statt Fragen im Fließtext, wenn du wirklich etwas wissen musst. Danach mit der Antwort direkt weiterarbeiten.\n" +
    "- quiz: {\"type\":\"quiz\",\"questions\":[{\"question\":\"…\",\"options\":[\"A\",\"B\",\"C\"],\"answer\":1,\"explanation\":\"…\"}]}\n" +
    "- gallery: {\"type\":\"gallery\",\"items\":[{\"image\":\"Stichwort\",\"caption\":\"…\"}]}\n" +
    "- prompt: {\"type\":\"prompt\",\"title\":\"…\",\"text\":\"Prompt zum Kopieren/Ausprobieren\"}\n" +
    "- buttons: {\"type\":\"buttons\",\"items\":[{\"label\":\"Kürzer\",\"prompt\":\"Mach es kürzer\"}]} – nächste Schritte per Klick (gut am Ende).\n" +
    "Beispiele: „Vergleiche X und Y“ → compare mit Bildern; „Rechner für …“ → calculator; „Erkläre Pythagoras“ → formula + calculator mit svg-Dreieck; " +
    "„Plane einen Ausflug“ → map + timeline + checklist; „Zeig Entwicklung meiner Ausgaben“ → chart; „Lernplan/Quiz“ → steps/quiz. " +
    "Für ganze Spiele oder Apps weiterhin eine ```datei:spiel.html``` schicken.";

  W.MythosSmartUI = { render, parse, PROMPT, LANG: "mythos-ui" };
})();
