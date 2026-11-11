// Mythos FX-Engine – echte Partikel-Effekte für die Modell-Animationen.
// Läuft auf der Website und in der Desktop-App (wird dort in renderer.js eingesetzt).
// Pro Modell ein eigener Effekt:
//   ember (Amber)     → lodernde Flammen am Bildschirmrand und an Buttons beim Hovern
//   sparks (Spark)    → Funkenregen mit Schweif
//   lightning (Bolt)  → zuckende Stromblitze an Rändern und um Buttons
//   orbit (Atlas)     → Partikel, die um Buttons kreisen, driftende Sterne am Rand
//   ripple (Pebble)   → Wellenringe
// API: MythosFx.start({ a, b, glow, fx }) · MythosFx.stop() · MythosFx.burst(x, y)
(function () {
  if (typeof window === "undefined" || window.MythosFx) return;
  const HOT = "button, a, [role=button], [role=menuitem], input[type=submit], summary, .mfx-hot";
  let cv = null, ctx = null, raf = 0, theme = null, W = 0, H = 0, dpr = 1, last = 0;
  let parts = [], arcs = [], hot = null, hotRect = null, sprites = {}, pointer = { x: -1, y: -1 };
  const MAX = window.matchMedia && matchMedia("(pointer: coarse)").matches ? 160 : 900;
  const reduced = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const hex = (h) => { const n = parseInt(String(h).replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

  // Weiches Leucht-Sprite pro Farbe (einmal gerendert, dann nur skaliert gezeichnet → schnell)
  function sprite(rgb, core) {
    const key = rgb.join(",") + (core || "");
    if (sprites[key]) return sprites[key];
    const s = document.createElement("canvas"); s.width = s.height = 64;
    const g = s.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, core || `rgba(${rgb},1)`);
    gr.addColorStop(0.35, `rgba(${rgb},.75)`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (sprites[key] = s);
  }

  const TOUCH = window.matchMedia && matchMedia("(pointer: coarse)").matches;
  function resize() {
    if (glc) glResize();
    dpr = TOUCH ? 1 : Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function onOver(e) {
    // Hover-Effekte nur mit Maus – auf dem Handy bleibt ein „Hover“ nach dem Antippen sonst hängen.
    if (e.pointerType && e.pointerType !== "mouse") { hot = null; hotRect = null; return; }
    const t = e.target && e.target.closest ? e.target.closest(HOT) : null;
    if (t === hot) return;
    hot = t; hotRect = t ? t.getBoundingClientRect() : null;
    if (t && theme && (theme.fx === "ripple" || theme.fx === "sparks")) burst(hotRect.left + hotRect.width / 2, hotRect.top + hotRect.height / 2, 0.5);
  }
  function onMove(e) { pointer.x = e.clientX; pointer.y = e.clientY; }
  function onScroll() { if (hot) hotRect = hot.getBoundingClientRect(); }


  // ---------- CGI-Feuer (WebGL-Shader) für Amber ----------
  let glc = null, gl = null, prog = null, U = {}, hotFade = 0, t0 = 0;
  const VS = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
  const FS = [
    "precision highp float;",
    "uniform vec2 uRes;uniform float uT;uniform vec4 uRect;uniform float uHot;uniform float uScale;",
    "float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
    "float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}",
    "float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}",
    // Flamme: d = Abstand über der Quelle (px), x = Position entlang der Quelle, H = Flammenhöhe
    "float fire(float d,float x,float H,float sp){",
    "  vec2 q=vec2(x*.022,d*.016-uT*sp);",
    "  float w=fbm(q*vec2(1.,.6)+vec2(0.,-uT*.4));",
    "  float f=fbm(q+vec2(w*1.6-.8,w*.6));",
    "  float tongue=.55+.45*n(vec2(x*.012,uT*.7));",
    "  float v=f*1.55-d/(H*tongue)-.18;",
    "  return clamp(v*1.7,0.,1.);}",
    "vec3 ramp(float v){return vec3(1.25,.55,.12)*smoothstep(.0,.35,v)+vec3(.0,.42,.25)*smoothstep(.35,.7,v)+vec3(.0,.1,.45)*smoothstep(.75,1.,v);}",
    "float sdBox(vec2 p,vec2 b){vec2 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,q.y),0.);}",
    "void main(){",
    "  vec2 px=gl_FragCoord.xy/uScale; float v=0.;",
    "  if(px.y<70.) v=max(v,fire(px.y,px.x,42.,1.1)*.8);",
    "  if(px.x<30.) v=max(v,fire(px.x,px.y*.7+uT*40.,14.,.9)*.6*smoothstep(0.,uRes.y*.6,uRes.y-px.y));",
    "  if(uRes.x-px.x<30.) v=max(v,fire(uRes.x-px.x,px.y*.7+uT*40.+300.,14.,.9)*.6*smoothstep(0.,uRes.y*.6,uRes.y-px.y));",
    "  if(uHot>0.){",
    "    vec2 c=uRect.xy+uRect.zw*.5; float d=sdBox(px-c,uRect.zw*.5-2.);",
    "    float up=clamp(px.y-(uRect.y+uRect.w),0.,120.);",   // nach oben länger
    "    float below=smoothstep(uRect.y-4.,uRect.y+uRect.w*.0+uRect.w*.5,px.y);",
    "    float hd=max(d,0.)*1.25;",
    "    if(hd<120.) v=max(v,fire(hd,px.x*1.3+900.,42.+uRect.z*.1+up*.4,2.4)*uHot*smoothstep(-6.,1.,d)*below);",
    "  }",
    "  vec3 col=ramp(v); float a=clamp(v*.9,0.,.8);",
    "  gl_FragColor=vec4(col*a,a);}",
  ].join("\n");
  function glStart() {
    if (glc) return true;
    glc = document.createElement("canvas"); glc.className = "mfx-fire";
    glc.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:44;width:100vw;height:100vh";
    gl = glc.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) { glc = null; return false; }
    const sh = (t, src) => { const o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    try { prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); }
    catch (e) { console.warn("Mythos FX", e); glc = null; gl = null; return false; }
    gl.useProgram(prog);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const k of ["uRes", "uT", "uRect", "uHot", "uScale"]) U[k] = gl.getUniformLocation(prog, k);
    document.body.appendChild(glc); t0 = performance.now(); glResize();
    return true;
  }
  const FIRE_SCALE = matchMedia("(pointer: coarse)").matches ? 0.4 : 0.6; // geringe Auflösung (Handy noch weniger) reicht für Feuer und spart viel Leistung
  function glResize() { if (!glc) return; glc.width = Math.round(innerWidth * FIRE_SCALE); glc.height = Math.round(innerHeight * FIRE_SCALE); gl.viewport(0, 0, glc.width, glc.height); }
  function glFrame(k) {
    if (!gl) return;
    hotFade += ((hotRect ? 1 : 0) - hotFade) * Math.min(1, 0.12 * k);
    const r = hotRect || lastHot;
    gl.uniform2f(U.uRes, innerWidth, innerHeight);
    gl.uniform1f(U.uT, (performance.now() - t0) / 1000);
    gl.uniform1f(U.uScale, FIRE_SCALE);
    gl.uniform1f(U.uHot, hotFade);
    if (r) gl.uniform4f(U.uRect, r.left, innerHeight - r.bottom, r.width, r.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  function glStop() { if (glc) { glc.remove(); const ext = gl && gl.getExtension("WEBGL_lose_context"); if (ext) ext.loseContext(); } glc = null; gl = null; prog = null; hotFade = 0; }
  let lastHot = null;

  // ---------- Partikel erzeugen ----------
  const add = (p) => { if (parts.length < MAX) parts.push(p); };
  function flame(x, y, size, power) {
    add({ k: "flame", x, y, vx: rnd(-0.25, 0.25), vy: -rnd(0.9, 2.1) * power, life: 1, decay: rnd(0.02, 0.036), s: size * rnd(0.7, 1.3), w: rnd(0, 6.28) });
  }
  function spark(x, y, vx, vy) { add({ k: "spark", x, y, px: x, py: y, vx, vy, life: 1, decay: rnd(0.012, 0.03), s: rnd(1, 2.4) }); }
  function dot(x, y, vx, vy, s) { add({ k: "dot", x, y, vx, vy, life: 1, decay: rnd(0.004, 0.01), s }); }
  function ring(x, y, r) { add({ k: "ring", x, y, r: 2, R: r, life: 1, decay: rnd(0.012, 0.02) }); }
  function orbiter(cx, cy) { add({ k: "orb", a: rnd(0, 6.28), sp: rnd(0.03, 0.06) * (Math.random() < 0.5 ? -1 : 1), life: 1, decay: rnd(0.008, 0.014), s: rnd(1.5, 3), rr: rnd(0.95, 1.25) }); }
  function arc(x1, y1, x2, y2, life) {
    const pts = [[x1, y1]], n = Math.max(4, Math.round(Math.hypot(x2 - x1, y2 - y1) / 18));
    for (let i = 1; i < n; i++) { const t = i / n; pts.push([x1 + (x2 - x1) * t + rnd(-9, 9), y1 + (y2 - y1) * t + rnd(-9, 9)]); }
    pts.push([x2, y2]); arcs.push({ pts, life: life || 1, decay: rnd(0.08, 0.14) });
  }
  function onPerimeter(r, pad) {
    const per = 2 * (r.width + r.height), d = Math.random() * per;
    if (d < r.width) return [r.left + d, r.top - pad, 0, -1];
    if (d < r.width + r.height) return [r.right + pad, r.top + d - r.width, 1, 0];
    if (d < 2 * r.width + r.height) return [r.right - (d - r.width - r.height), r.bottom + pad, 0, 1];
    return [r.left - pad, r.bottom - (d - 2 * r.width - r.height), -1, 0];
  }

  function emit(dt) {
    const fx = theme.fx, k = dt / 16.7;
    if (fx === "ember") {
      if (!gl) {
        for (let i = 0; i < 5 * k; i++) flame(rnd(0, W), H + 4, rnd(18, 34), rnd(0.7, 1.25));
        if (hotRect) for (let i = 0; i < 9 * k; i++) { const [x, y] = onPerimeter(hotRect, -2); flame(x, y, rnd(14, 26), 1.05); }
      }
      // Glutfunken, die aus dem Feuer aufsteigen
      if (Math.random() < 0.06 * k) spark(rnd(0, W), H - rnd(5, 40), rnd(-0.5, 0.5), -rnd(2.2, 4.2));
      if (hotRect && Math.random() < 0.15 * k) spark(rnd(hotRect.left, hotRect.right), hotRect.top - rnd(0, 30), rnd(-0.8, 0.8), -rnd(1.8, 3.6));
    } else if (fx === "sparks") {
      for (let i = 0; i < 0.5 * k; i++) spark(rnd(0, W), -4, rnd(-0.4, 0.4), rnd(1.5, 3.5));
      for (let i = 0; i < 0.25 * k; i++) { const side = Math.random() < 0.5; spark(side ? 0 : W, rnd(0, H), side ? rnd(1, 3) : -rnd(1, 3), rnd(-1.5, 0.5)); }
      if (hotRect) for (let i = 0; i < 1.2 * k; i++) { const [x, y, nx, ny] = onPerimeter(hotRect, 1); spark(x, y, nx * rnd(1, 3) + rnd(-0.6, 0.6), ny * rnd(1, 3) - rnd(0, 1.2)); }
    } else if (fx === "lightning") {
      if (Math.random() < 0.02 * k) { const e = Math.floor(rnd(0, 4)); const p = rnd(0, 1); if (e === 0) arc(p * W, 0, p * W + rnd(-120, 120), rnd(40, 140)); else if (e === 1) arc(W, p * H, W - rnd(40, 160), p * H + rnd(-80, 80)); else if (e === 2) arc(p * W, H, p * W + rnd(-120, 120), H - rnd(40, 160)); else arc(0, p * H, rnd(40, 160), p * H + rnd(-80, 80)); }
      for (let i = 0; i < 0.4 * k; i++) dot(rnd(0, W), Math.random() < 0.5 ? rnd(0, 20) : H - rnd(0, 20), rnd(-0.5, 0.5), rnd(-0.5, 0.5), rnd(1, 2));
      if (hotRect && Math.random() < 0.18 * k) { const [x1, y1] = onPerimeter(hotRect, 0), [x2, y2, nx, ny] = onPerimeter(hotRect, 0); arc(x1, y1, x2 + nx * rnd(10, 40), y2 + ny * rnd(10, 40), 1); }
      if (hotRect) for (let i = 0; i < 0.5 * k; i++) { const [x, y, nx, ny] = onPerimeter(hotRect, 1); spark(x, y, nx * rnd(0.5, 2), ny * rnd(0.5, 2)); }
    } else if (fx === "orbit") {
      for (let i = 0; i < 0.35 * k; i++) dot(Math.random() < 0.5 ? rnd(0, 40) : W - rnd(0, 40), rnd(0, H), rnd(-0.2, 0.2), -rnd(0.2, 0.7), rnd(1, 2.6));
      if (hotRect && parts.filter((p) => p.k === "orb").length < 10) for (let i = 0; i < 1 * k; i++) orbiter();
    } else if (fx === "ripple") {
      if (Math.random() < 0.006 * k) ring(rnd(0, W), Math.random() < 0.5 ? rnd(0, 60) : H - rnd(0, 60), rnd(40, 110));
      if (hotRect && Math.random() < 0.04 * k) ring(hotRect.left + hotRect.width / 2, hotRect.top + hotRect.height / 2, Math.max(hotRect.width, hotRect.height) * 0.9);
    }
  }

  // ---------- Zeichnen ----------
  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = Math.min(50, t - (last || t)); last = t;
    if (hot && !hot.isConnected) { hot = null; hotRect = null; }
    if (hotRect) lastHot = hotRect;
    if (gl) glFrame(dt / 16.7);
    emit(dt);
    const k = dt / 16.7, A = theme.rgbA, B = theme.rgbB;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    const sY = sprite([255, 210, 90], "rgba(255,245,200,1)"), sO = sprite(A), sR = sprite(B), sA = sprite(A, "rgba(255,255,255,1)");
    let n = 0;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.life -= p.decay * k;
      if (p.life <= 0) continue;
      parts[n++] = p;
      if (p.k === "flame") {
        p.w += 0.12 * k; p.x += (p.vx + Math.sin(p.w) * 0.45) * k; p.y += p.vy * k; p.vy *= 1 - 0.004 * k;
        const L = p.life, img = L > 0.72 ? sY : L > 0.38 ? sO : sR, sz = p.s * (0.45 + L * 0.75);
        // Flammenzunge: schmal und hoch, oben spitz zulaufend
        ctx.globalAlpha = Math.min(1, L * 1.4) * 0.42;
        ctx.drawImage(img, p.x - sz * 0.32, p.y - sz * 1.1, sz * 0.64, sz * 1.9);
        if (L > 0.55) { ctx.globalAlpha = (L - 0.55) * 0.9; ctx.drawImage(sY, p.x - sz * 0.15, p.y - sz * 0.35, sz * 0.3, sz * 0.7); }
      } else if (p.k === "spark") {
        p.px = p.x; p.py = p.y; p.vy += 0.045 * k; p.x += p.vx * k; p.y += p.vy * k;
        ctx.globalAlpha = p.life; ctx.strokeStyle = `rgb(${A})`; ctx.lineWidth = p.s;
        ctx.beginPath(); ctx.moveTo(p.px - p.vx * 3, p.py - p.vy * 3); ctx.lineTo(p.x, p.y); ctx.stroke();
        ctx.drawImage(sA, p.x - 5, p.y - 5, 10, 10);
      } else if (p.k === "dot") {
        p.x += p.vx * k; p.y += p.vy * k;
        ctx.globalAlpha = Math.sin(p.life * Math.PI) * 0.9; const sz = p.s * 5;
        ctx.drawImage(p.s > 2 ? sR : sA, p.x - sz / 2, p.y - sz / 2, sz, sz);
      } else if (p.k === "ring") {
        p.r += (p.R - p.r) * 0.04 * k;
        ctx.globalAlpha = p.life * 0.8; ctx.strokeStyle = `rgb(${A})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.stroke();
      } else if (p.k === "orb") {
        if (!hotRect) p.life -= 0.05 * k;
        p.a += p.sp * k;
        const r = hotRect || { left: pointer.x, top: pointer.y, width: 0, height: 0 };
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2, rx = (r.width / 2 + 14) * p.rr, ry = (r.height / 2 + 14) * p.rr;
        p.x = cx + Math.cos(p.a) * rx; p.y = cy + Math.sin(p.a) * ry;
        ctx.globalAlpha = Math.min(1, p.life * 2); const sz = p.s * 5;
        ctx.drawImage(Math.sin(p.a) > 0 ? sA : sR, p.x - sz / 2, p.y - sz / 2, sz, sz);
      }
    }
    parts.length = n;
    // Blitze
    let m = 0;
    for (let i = 0; i < arcs.length; i++) {
      const a = arcs[i]; a.life -= a.decay * k; if (a.life <= 0) continue; arcs[m++] = a;
      for (const [w, al, col] of [[10, 0.25, `rgb(${B})`], [4, 0.7, `rgb(${A})`], [1.6, 1, "#fff"]]) {
        ctx.globalAlpha = a.life * al; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
        a.pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      }
      if (Math.random() < 0.3) a.pts = a.pts.map(([x, y], j) => (j && j < a.pts.length - 1 ? [x + rnd(-3, 3), y + rnd(-3, 3)] : [x, y]));
    }
    arcs.length = m;
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }

  function burst(x, y, scale) {
    if (!theme) return;
    const s = scale || 1, fx = theme.fx;
    for (let i = 0; i < 22 * s; i++) {
      const an = rnd(0, 6.283), v = rnd(1.5, 6) * s;
      if (fx === "ember") { if (i % 2) spark(x, y, Math.cos(an) * v, Math.sin(an) * v - 1.5); else if (!gl) flame(x + rnd(-8, 8), y + rnd(-8, 8), rnd(14, 30), rnd(0.8, 1.6)); }
      else if (fx === "ripple") { if (i < 3) ring(x, y, 60 + i * 50); }
      else spark(x, y, Math.cos(an) * v, Math.sin(an) * v);
    }
    if (fx === "lightning") for (let i = 0; i < 6 * s; i++) { const an = rnd(0, 6.283), d = rnd(60, 200) * s; arc(x, y, x + Math.cos(an) * d, y + Math.sin(an) * d); }
  }

  function start(t) {
    if (reduced()) return stop();
    theme = { ...t, rgbA: hex(t.a), rgbB: hex(t.b) };
    sprites = {};
    if (!cv) {
      cv = document.createElement("canvas"); cv.className = "mfx-canvas";
      cv.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:45";
      ctx = cv.getContext("2d");
      document.body.appendChild(cv); resize();
      addEventListener("resize", resize); document.addEventListener("pointerover", onOver, true);
      document.addEventListener("pointermove", onMove, { passive: true }); addEventListener("scroll", onScroll, true);
    }
    parts = []; arcs = [];
    // Auf Handys kein WebGL-Feuer (spart viel Speicher), stattdessen die leichte Partikel-Variante.
    if (theme.fx === "ember" && !TOUCH) { glStart(); } else glStop();
    if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
  }
  function stop() {
    cancelAnimationFrame(raf); raf = 0; theme = null; parts = []; arcs = []; glStop();
    if (cv) {
      cv.remove(); cv = null; ctx = null;
      removeEventListener("resize", resize); document.removeEventListener("pointerover", onOver, true);
      document.removeEventListener("pointermove", onMove); removeEventListener("scroll", onScroll, true);
    }
  }
  window.MythosFx = { start, stop, burst: (x, y, s) => burst(x, y, s), running: () => !!theme };
})();
