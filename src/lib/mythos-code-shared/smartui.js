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
.msui-dr{position:relative;overflow:hidden;background:radial-gradient(120% 80% at 0% 0%,rgba(167,139,250,.14),transparent 55%),radial-gradient(120% 80% at 100% 100%,rgba(56,189,248,.1),transparent 55%),var(--bg)}
.msui-dr-title{font-weight:750;font-size:17px;margin-bottom:6px;letter-spacing:-.01em}
.msui-dr-themes{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:8px 0 10px}
.msui-dr-theme{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:14px;border-radius:16px;border:1px solid var(--bd);background:linear-gradient(145deg,rgba(255,255,255,.06),rgba(255,255,255,.02));color:inherit;font:inherit;text-align:left;cursor:pointer;overflow:hidden;animation:msuiDrIn .5s cubic-bezier(.2,.9,.3,1.3) both;transition:transform .2s,border-color .2s,box-shadow .2s}
.msui-dr-theme::after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.12) 50%,transparent 70%);transform:translateX(-100%);transition:transform .7s}
.msui-dr-theme:hover{transform:translateY(-3px) scale(1.02);border-color:var(--a);box-shadow:0 10px 30px -12px var(--a)}
.msui-dr-theme:hover::after{transform:translateX(100%)}
.msui-dr-theme .e{font-size:30px;transition:transform .3s}.msui-dr-theme:hover .e{transform:rotate(-10deg) scale(1.2)}
.msui-dr-theme .t{font-weight:650;font-size:14.5px}.msui-dr-theme .d{color:var(--mut);font-size:12px}
.msui-dr-own{display:flex;gap:8px;align-items:center}.msui-dr-own .msui-q-other{flex:1;margin:0}
.msui-dr-go{opacity:.6;pointer-events:none;transition:opacity .3s}
.msui-dr-prog{height:4px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden;margin:4px 0 12px}.msui-dr-prog i{display:block;height:100%;background:linear-gradient(90deg,#a78bfa,#38bdf8);transition:width .5s}
.msui-dr-teams{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.msui-dr-team{border:1px solid var(--bd);border-radius:14px;padding:9px;background:rgba(0,0,0,.15)}
.msui-dr-team.bot{background:rgba(167,139,250,.06)}
.msui-dr-th{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:13px}
.msui-dr-cash{font-variant-numeric:tabular-nums;font-weight:700;padding:1px 8px;border-radius:99px;background:rgba(251,191,36,.15);color:#fbbf24}
.msui-dr-slots{display:flex;flex-direction:column;gap:4px}
.msui-dr-slot{display:flex;align-items:center;gap:6px;min-height:30px;padding:4px 7px;border-radius:9px;border:1px dashed var(--bd);font-size:12.5px;color:var(--mut)}
.msui-dr-slot.full{border-style:solid;color:inherit;background:rgba(255,255,255,.04)}
.msui-dr-slot .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.msui-dr-slot .p{color:var(--mut);font-size:11px;font-variant-numeric:tabular-nums}
.msui-dr-slot.pop{animation:msuiDrPop .6s cubic-bezier(.2,.9,.3,1.5)}
.msui-dr-stage{display:grid;grid-template-columns:minmax(150px,200px) 1fr;gap:14px;align-items:center;margin-top:14px}
@media (max-width:520px){.msui-dr-stage{grid-template-columns:1fr}.msui-dr-teams{grid-template-columns:1fr}}
.msui-dr-card{position:relative;border-radius:18px;padding:16px 14px;text-align:center;border:1px solid var(--glow);background:linear-gradient(160deg,rgba(255,255,255,.09),rgba(255,255,255,.02));box-shadow:0 0 0 1px rgba(255,255,255,.04),0 12px 40px -14px var(--glow);animation:msuiDrFloat 3.5s ease-in-out infinite}
.msui-dr-card.flip{animation:msuiDrFlip .7s cubic-bezier(.2,.8,.2,1) both,msuiDrFloat 3.5s ease-in-out .7s infinite}
.msui-dr-card::before{content:"";position:absolute;inset:-1px;border-radius:inherit;padding:1px;background:conic-gradient(from var(--ang,0deg),transparent 0 70%,var(--glow) 85%,transparent);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:msuiDrSpin 3s linear infinite}
.msui-dr-card .e{font-size:46px;line-height:1.1;filter:drop-shadow(0 6px 12px rgba(0,0,0,.4))}
.msui-dr-card .n{font-weight:700;font-size:15px;margin-top:6px}.msui-dr-card .d{color:var(--mut);font-size:12px;margin-top:4px}.msui-dr-card .c{color:var(--mut);font-size:10.5px;margin-top:8px;text-transform:uppercase;letter-spacing:.08em}
.msui-dr-panel{display:flex;flex-direction:column;gap:10px}
.msui-dr-turn{font-weight:600;font-size:14px}.msui-dr-turn.bot{color:#c4b5fd}.msui-dr-turn.bot::after{content:"";display:inline-block;width:1.2em;text-align:left;animation:msuiDrDots 1.2s steps(4) infinite}
.msui-dr-bid{display:flex;align-items:baseline;gap:8px}.msui-dr-bid .l{color:var(--mut);font-size:12px}.msui-dr-bid .v{font-size:32px;font-weight:800;font-variant-numeric:tabular-nums;background:linear-gradient(90deg,#fbbf24,#f97316);-webkit-background-clip:text;background-clip:text;color:transparent}.msui-dr-bid .w{color:var(--mut);font-size:12px}
.msui-dr-bid.pop .v{display:inline-block;animation:msuiDrPop .45s cubic-bezier(.2,.9,.3,1.6)}
.msui-dr-main{background:linear-gradient(135deg,rgba(167,139,250,.35),rgba(56,189,248,.25));border-color:rgba(167,139,250,.5);font-weight:600;transition:transform .15s,box-shadow .2s}
.msui-dr-main:hover{transform:translateY(-1px);box-shadow:0 6px 20px -8px #a78bfa}.msui-dr-main:active{transform:scale(.96)}
.msui-dr-log{margin-top:12px;font-size:12px;color:var(--mut);display:flex;flex-direction:column;gap:2px}.msui-dr-log .new{color:inherit;animation:msuiDrIn .4s ease both}
.msui-dr-reset{position:absolute;top:12px;right:14px;border:0;background:none;color:var(--mut);font:inherit;font-size:11px;cursor:pointer}.msui-dr-reset:hover{color:inherit}
.msui-dr-endbox{position:relative;margin-top:14px;text-align:center;padding:10px 0 2px}.msui-dr-endbox .msui-btns{justify-content:center}
.msui-dr-big{font-size:22px;font-weight:800;margin-bottom:10px;animation:msuiDrPop .7s cubic-bezier(.2,.9,.3,1.6)}
.msui-dr-confetti{position:absolute;inset:-40px 0 0;pointer-events:none;overflow:hidden}.msui-dr-confetti i{position:absolute;top:-10px;width:7px;height:11px;border-radius:2px;animation:msuiDrFall 2.2s cubic-bezier(.3,.6,.5,1) forwards}
@keyframes msuiDrIn{from{opacity:0;transform:translateY(10px) scale(.96)}to{opacity:1;transform:none}}
@keyframes msuiDrPop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.12);opacity:1}100%{transform:scale(1)}}
@keyframes msuiDrFlip{0%{transform:perspective(700px) rotateY(90deg) scale(.9);opacity:0}100%{transform:perspective(700px) rotateY(0) scale(1);opacity:1}}
@keyframes msuiDrFloat{0%,100%{translate:0 0}50%{translate:0 -4px}}
@keyframes msuiDrSpin{to{--ang:360deg}}
@keyframes msuiDrDots{0%{content:""}25%{content:"."}50%{content:".."}75%{content:"..."}}
@keyframes msuiDrFall{0%{transform:translateY(0) rotate(0)}100%{transform:translateY(260px) rotate(540deg);opacity:0}}

.msui-dr-theme.on{border-color:var(--a);box-shadow:0 0 0 1px var(--a),0 10px 30px -14px var(--a);background:linear-gradient(145deg,rgba(167,139,250,.18),rgba(255,255,255,.02))}
.msui-gs-cfg{display:flex;flex-direction:column;gap:10px;margin-top:4px}
.msui-gs-row{display:flex;justify-content:space-between;align-items:center;font-size:14px}
.msui-gs-step{display:flex;align-items:center;gap:10px}.msui-gs-step button{width:32px;height:32px;border-radius:50%;border:1px solid var(--bd);background:rgba(255,255,255,.06);color:inherit;font-size:18px;cursor:pointer;transition:transform .15s}.msui-gs-step button:active{transform:scale(.88)}.msui-gs-step button:disabled{opacity:.3;cursor:default}.msui-gs-step b{min-width:18px;text-align:center;font-size:18px;font-variant-numeric:tabular-nums}
.msui-gs-ppl{display:flex;flex-wrap:wrap;gap:6px}.msui-gs-av{padding:4px 10px;border-radius:99px;font-size:12.5px;font-weight:600;border:1px solid var(--c);color:var(--c);background:color-mix(in srgb,var(--c) 12%,transparent);animation:msuiDrPop .4s cubic-bezier(.2,.9,.3,1.5) both}
.msui-pg-rolewrap{position:relative;margin:4px 0 12px}
.msui-pg-role{display:flex;flex-direction:column;align-items:center;gap:2px;padding:14px;border-radius:16px;border:1px solid rgba(167,139,250,.4);background:linear-gradient(135deg,rgba(167,139,250,.16),rgba(56,189,248,.08));animation:msuiDrFlip .7s cubic-bezier(.2,.8,.2,1) both}
.msui-pg-role.imp{border-color:rgba(248,113,113,.55);background:linear-gradient(135deg,rgba(248,113,113,.2),rgba(251,146,60,.08))}
.msui-pg-role .k{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--mut)}.msui-pg-role b{font-size:24px;font-weight:800}.msui-pg-role .h{font-size:12px;color:var(--mut)}
.msui-pg-veil{position:absolute;inset:0;border-radius:16px;border:1px dashed var(--bd);background:rgba(10,10,15,.82);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:inherit;font:inherit;font-weight:600;cursor:pointer}
.msui-pg-players{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:10px}
.msui-pg-p{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:64px;padding:8px 6px;border-radius:14px;border:1px solid var(--bd);animation:msuiDrIn .45s cubic-bezier(.2,.9,.3,1.3) both;transition:transform .3s,box-shadow .3s}
.msui-pg-p .av{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;color:#0b0b0f;background:radial-gradient(circle at 30% 30%,#fff8,var(--c))}
.msui-pg-p .n{font-size:12px;font-weight:600}.msui-pg-p .c{font-size:11px;padding:1px 6px;border-radius:6px;background:rgba(255,255,255,.08)}
.msui-pg-p.active{transform:translateY(-3px);box-shadow:0 0 0 1px var(--c),0 8px 24px -8px var(--c)}.msui-pg-p.active .av{animation:msuiPgPulse 1.4s ease-in-out infinite}
.msui-pg-p.out{opacity:.35;filter:grayscale(1)}
@keyframes msuiPgPulse{0%,100%{box-shadow:0 0 0 0 var(--c)}50%{box-shadow:0 0 0 7px transparent}}
.msui-pg-timer{position:relative;overflow:hidden;border-radius:10px;border:1px solid var(--bd);padding:6px 10px;margin-bottom:10px;font-weight:700;font-variant-numeric:tabular-nums;text-align:center}
.msui-pg-timer i{position:absolute;left:0;bottom:0;height:3px;background:linear-gradient(90deg,#a78bfa,#38bdf8);transition:width 1s linear}
.msui-pg-timer.low{color:#f87171;animation:msuiPgShake .5s ease-in-out infinite}.msui-pg-timer.low i{background:#f87171}
@keyframes msuiPgShake{0%,100%{transform:none}25%{transform:translateX(-1px)}75%{transform:translateX(1px)}}
.msui-pg-log{display:flex;flex-direction:column;gap:6px;margin-bottom:10px;max-height:240px;overflow-y:auto}
.msui-pg-li{font-size:13px;padding:7px 10px;border-radius:12px;background:rgba(255,255,255,.04)}.msui-pg-li.new{animation:msuiDrIn .5s ease both;background:rgba(167,139,250,.1)}
.msui-pg-li .a{color:var(--mut);margin-top:2px}
.msui-pg-panel{display:flex;flex-direction:column;gap:8px}
.msui-pg-nudge{animation:msuiPgShake .25s 2}
.msui-pg-target.on{border-color:var(--c);color:var(--c);background:color-mix(in srgb,var(--c) 14%,transparent)}
.msui-pg-reveal{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:6px 0 10px}.msui-pg-rc{display:flex;flex-direction:column;padding:8px 12px;border-radius:12px;border:1px solid var(--bd);animation:msuiDrFlip .6s cubic-bezier(.2,.8,.2,1) both}.msui-pg-rc span{font-size:12px;color:var(--mut)}
@property --ang{syntax:"<angle>";inherits:false;initial-value:0deg}
@media (prefers-reduced-motion:reduce){.msui-dr *{animation:none!important;transition:none!important}}
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
  B.choice = (s, ctx) => {
    const box = mk("div", "msui-box"); box._ctx = ctx; head(box, s, ctx); choiceInto(box, s); note(box, s);
    // Auswahl ist fast immer eine Frage an den Nutzer („Was wollen wir bauen?“) – also muss sie sich auch abschicken lassen.
    const opts = arr(s.options || s.criteria || s.tabs);
    if (ctx && typeof ctx.send === "function" && s.send !== false && s.noSend !== true && opts.length > 1) {
      const q = s.question || s.label || s.title || "Auswahl";
      const key = "msui-c-" + hash(JSON.stringify([q, opts]));
      const done = (txt) => { const d = mk("div", "msui-q-done"); d.style.marginTop = "10px"; d.append(mk("span", "", "✓"), mk("span", "", "Gewählt: " + txt)); return d; };
      const answered = store.get(key);
      if (answered) { box.querySelectorAll(".msui-opt").forEach((b) => { b.disabled = true; }); box.appendChild(done(answered)); return box; }
      const btn = mk("button", "msui-q-send", ""); btn.type = "button"; btn.style.marginTop = "10px";
      const labelOf = (o) => (o && typeof o === "object" ? String(o.label || o.title || o.text || "") : String(o));
      const cur = () => { const on = [...box.querySelectorAll(".msui-opt")].findIndex((b) => b.classList.contains("on")); return on < 0 ? 0 : on; };
      const upd = () => { btn.textContent = (s.submit || "Weiter mit") + " „" + labelOf(opts[cur()]) + "“"; };
      box.querySelectorAll(".msui-opt").forEach((b) => b.addEventListener("click", upd));
      btn.onclick = () => {
        const o = opts[cur()], label = labelOf(o);
        const extra = o && typeof o === "object" && (o.text || o.description) ? " – " + String(o.text || o.description).replace(/\s+/g, " ").slice(0, 160) : "";
        store.set(key, label);
        ctx.send("Antwort auf „" + q + "“: " + label + extra);
        box.querySelectorAll(".msui-opt").forEach((x) => { x.disabled = true; });
        btn.replaceWith(done(label));
      };
      upd(); box.appendChild(btn);
    }
    return box;
  };
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
            ctx.send("Quiz geschafft" + (s.title ? " „" + s.title + "“" : "") + ": " + right + " von " + qs.length + " richtig." + (wrong.length ? " Falsch beantwortet: " + wrong.join("; ") + ". Erklär mir kurz, was ich da falsch verstanden habe, und stell mir dazu eine neue Frage." : " Alles richtig – gib mir schwierigere Fragen."));
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


  // ---------- 20-€-Draft (Bietspiel gegen Mythos) ----------
  // Themen-Auswahl: {"type":"draft","themes":[{"title":"Fußball-Startelf","emoji":"⚽"},…]}
  // Spiel:          {"type":"draft","theme":"Burger","emoji":"🍔","budget":20,"slots":5,"deck":[{"name":"Wagyu-Patty","emoji":"🥩","value":9,"note":"…"},…]}
  // Regeln (TikTok-$20-Draft): Karte wird aufgedeckt; wer am Zug ist, nimmt sie für 1 € oder verschenkt sie (je 2×,
  // belegt einen Platz beim Gegner). Nach dem Nehmen darf der andere erhöhen oder passen – abwechselnd, bis einer passt.
  // Pleite (0 €) = Karten kommen gratis. Reserve: man behält mind. 1 € je weiterem freien Platz. Die bessere Liste gewinnt.
  B.draft = (s, ctx) => (Array.isArray(s.deck) && s.deck.length ? draftGame(s, ctx) : draftThemes(s, ctx));
  B.bietspiel = B.draft; B.draft20 = B.draft;

  function draftThemes(s, ctx) {
    const box = mk("div", "msui-box msui-dr");
    box.appendChild(mk("div", "msui-dr-title", "💶 20-€-Draft"));
    box.appendChild(mk("div", "msui-sub", s.subtitle || "Jeder hat 20 € und 5 Plätze. Bietet abwechselnd – wer passt, verliert die Karte. Am Ende gewinnt die bessere Aufstellung."));
    const grid = mk("div", "msui-dr-themes");
    const start = (t) => { box.classList.add("msui-dr-go"); ctx.send("Starte das 20-€-Draft mit dem Thema „" + t + "“."); };
    arr(s.themes).slice(0, 3).forEach((t, i) => {
      const title = (t && typeof t === "object" ? String(t.title || t.name || t.label || "") : "") || str(t), emoji = (t && t.emoji) || ["⚽", "🍔", "🌳"][i] || "🎲";
      const b = mk("button", "msui-dr-theme"); b.type = "button"; b.style.animationDelay = i * 90 + "ms";
      b.append(mk("span", "e", emoji), mk("span", "t", title));
      if (t && t.text) b.appendChild(mk("span", "d", t.text));
      b.onclick = () => start(title);
      grid.appendChild(b);
    });
    box.appendChild(grid);
    const row = mk("div", "msui-dr-own");
    const inp = mk("input", "msui-q-other"); inp.placeholder = "Eigenes Thema, z. B. „Bester Garten“ …";
    const go = mk("button", "msui-q-send", "Los"); go.type = "button";
    go.onclick = () => { const v = inp.value.trim(); if (v) start(v); };
    inp.onkeydown = (e) => { if (e.key === "Enter") go.click(); };
    row.append(inp, go); box.appendChild(row);
    return box;
  }

  function draftGame(s, ctx) {
    const deck = arr(s.deck).map((c) => ({ name: str(c.name || c.title || c), emoji: (c && c.emoji) || "🃏", value: Math.max(1, Math.min(10, Number(c && c.value) || 5)), note: (c && (c.note || c.text)) || "" })).filter((c) => c.name);
    const BUDGET = Math.max(5, Math.min(100, Number(s.budget) || 20)), SLOTS = Math.max(3, Math.min(11, Number(s.slots) || 5)), GIFTS = 2;
    const theme = str(s.theme || s.title || "Draft"), themeEmoji = s.emoji || "🏆";
    const key = "msui-draft-" + hash(JSON.stringify([theme, deck.map((c) => c.name)]));
    const fresh = () => ({ i: 0, turn: Math.random() < 0.5 ? 0 : 1, phase: "offer", bid: 0, high: -1, toAct: -1, p: [{ cash: BUDGET, team: [], gifts: GIFTS }, { cash: BUDGET, team: [], gifts: GIFTS }], log: [], done: false });
    let st = store.get(key); if (!st || !st.p) { st = fresh(); store.set(key, st); }
    const NAME = ["Du", "Mythos"];
    const save = () => store.set(key, st);
    const open = (who) => SLOTS - st.p[who].team.length;
    // Reserve: nach diesem Kauf muss noch 1 € pro weiterem freien Platz übrig bleiben.
    const maxBid = (who) => Math.max(0, st.p[who].cash - Math.max(0, open(who) - 1));
    const card = () => deck[st.i];
    const box = mk("div", "msui-box msui-dr");
    let timer = 0, lastFx = "";

    function give(who, price, how) {
      const c = card();
      st.p[who].cash -= price; st.p[who].team.push({ name: c.name, emoji: c.emoji, value: c.value, price });
      st.log.unshift((who ? "🤖 Mythos" : "🙂 Du") + " bekommt " + c.emoji + " " + c.name + (how === "gift" ? " geschenkt" : " für " + price + " €"));
      lastFx = "win" + who;
      next();
    }
    function next() {
      st.i++; st.phase = "offer"; st.bid = 0; st.high = -1; st.toAct = -1;
      st.turn = 1 - st.turn;
      if (st.i >= deck.length || (open(0) <= 0 && open(1) <= 0)) st.done = true;
      save(); draw();
    }
    // Wer ist bei dieser Karte überhaupt dabei?
    function autoResolve() {
      if (st.done || st.phase !== "offer") return false;
      const a = open(0) > 0, b = open(1) > 0;
      if (!a && !b) { st.done = true; save(); return false; }
      if (!a || !b) { // nur einer hat noch Platz → bekommt die Karte zum Mindestpreis (pleite = gratis)
        const who = a ? 0 : 1; give(who, st.p[who].cash > 0 ? 1 : 0, "solo"); return true;
      }
      const t = st.turn;
      if (st.p[t].cash <= 0) { give(t, 0, "broke"); return true; }
      return false;
    }
    function take(who) { st.phase = "bid"; st.bid = 1; st.high = who; st.toAct = 1 - who; lastFx = "bid"; save(); maybePassBroke(); draw(); }
    function gift(who) { st.p[who].gifts--; give(1 - who, 0, "gift"); }
    function raise(who, amount) { st.bid = amount; st.high = who; st.toAct = 1 - who; lastFx = "bid"; save(); maybePassBroke(); draw(); }
    function pass() { give(st.high, st.bid, "bid"); }
    function maybePassBroke() { if (st.phase === "bid" && st.toAct === 0 && maxBid(0) <= st.bid) { setTimeout(() => { if (st.phase === "bid" && st.toAct === 0) pass(); }, 900); } }

    // Mythos (Bot): schätzt den Wert gegen sein Restgeld und die offenen Plätze ab.
    function botLimit() {
      const c = card(), fair = st.p[1].cash / Math.max(1, open(1));
      const want = fair * (0.35 + c.value / 6.5) * (0.85 + Math.random() * 0.3);
      return Math.min(maxBid(1), Math.max(1, Math.round(want)));
    }
    function botMove() {
      if (st.done) return;
      if (st.phase === "offer" && st.turn === 1) {
        const c = card();
        if (c.value <= 3 && st.p[1].gifts > 0 && open(0) > 1) return gift(1);
        return take(1);
      }
      if (st.phase === "bid" && st.toAct === 1) {
        const lim = botLimit();
        if (st.bid < lim) return raise(1, Math.min(lim, st.bid + (lim - st.bid > 4 && Math.random() < 0.4 ? 2 : 1)));
        return pass();
      }
    }

    function slotRow(who) {
      const p = st.p[who], wrap = mk("div", "msui-dr-team" + (who ? " bot" : ""));
      const top = mk("div", "msui-dr-th"); top.append(mk("b", "", (who ? "🤖 " : "🙂 ") + NAME[who]), mk("span", "msui-dr-cash", p.cash + " €"));
      wrap.appendChild(top);
      const sl = mk("div", "msui-dr-slots");
      for (let i = 0; i < SLOTS; i++) {
        const it = p.team[i], d = mk("div", "msui-dr-slot" + (it ? " full" : ""));
        if (it) { d.append(mk("span", "e", it.emoji), mk("span", "n", it.name), mk("span", "p", it.price ? it.price + " €" : "gratis")); if (i === p.team.length - 1 && lastFx === "win" + who) d.classList.add("pop"); }
        else d.appendChild(mk("span", "n", "frei"));
        sl.appendChild(d);
      }
      wrap.appendChild(sl);
      return wrap;
    }

    function draw() {
      clearTimeout(timer);
      if (!st.done && autoResolve()) return;
      box.replaceChildren();
      const h = mk("div", "msui-dr-title"); h.append(mk("span", "", themeEmoji + " 20-€-Draft: " + theme)); box.appendChild(h);
      const prog = mk("div", "msui-dr-prog"); const bar = mk("i"); bar.style.width = Math.round((Math.min(st.i, deck.length) / deck.length) * 100) + "%"; prog.appendChild(bar); box.appendChild(prog);
      const teams = mk("div", "msui-dr-teams"); teams.append(slotRow(0), slotRow(1)); box.appendChild(teams);

      if (st.done) {
        box.classList.add("msui-dr-end");
        const end = mk("div", "msui-dr-endbox");
        end.appendChild(mk("div", "msui-dr-big", "🏁 Draft vorbei!"));
        const conf = mk("div", "msui-dr-confetti"); for (let k = 0; k < 28; k++) { const c = mk("i"); c.style.left = Math.random() * 100 + "%"; c.style.animationDelay = Math.random() * 0.6 + "s"; c.style.background = PALETTE[k % PALETTE.length]; conf.appendChild(c); }
        end.appendChild(conf);
        const list = (who) => st.p[who].team.map((t) => t.emoji + " " + t.name + " (" + (t.price ? t.price + " €" : "gratis") + ")").join(", ") || "nichts";
        const btns = mk("div", "msui-btns");
        const judge = mk("button", "msui-btn msui-dr-main", "🏆 Mythos soll entscheiden"); judge.type = "button";
        judge.onclick = () => ctx.send("20-€-Draft „" + theme + "“ ist vorbei. Meine Aufstellung (" + st.p[0].cash + " € übrig): " + list(0) + ". Deine Aufstellung (" + st.p[1].cash + " € übrig): " + list(1) + ". Vergleiche beide ehrlich Platz für Platz, vergib je eine Note und sag, wer gewonnen hat – nur Text, keine Grafik.");
        const g0 = mk("button", "msui-btn", "🎨 Meine als Grafik"); g0.type = "button";
        g0.onclick = () => ctx.send("/grafik Quadratische Grafik 1028×1028 (viewBox 0 0 1028 1028), Thema „" + theme + "“: meine Draft-Aufstellung – " + list(0).replace(/ \([^)]*\)/g, "") + ". Alle Teile als ein stimmiges Gesamtbild, Titel „Meine Aufstellung“.");
        const g1 = mk("button", "msui-btn", "🎨 Mythos’ als Grafik"); g1.type = "button";
        g1.onclick = () => ctx.send("/grafik Quadratische Grafik 1028×1028 (viewBox 0 0 1028 1028), Thema „" + theme + "“: die Draft-Aufstellung von Mythos – " + list(1).replace(/ \([^)]*\)/g, "") + ". Alle Teile als ein stimmiges Gesamtbild, Titel „Mythos’ Aufstellung“.");
        const again = mk("button", "msui-btn", "🔁 Neue Runde"); again.type = "button";
        again.onclick = () => ctx.send("Lass uns nochmal das 20-€-Draft spielen – schlag mir 3 neue Themen vor.");
        btns.append(judge, g0, g1, again); end.appendChild(btns);
        box.appendChild(end);
        return;
      }

      const c = card();
      const stage = mk("div", "msui-dr-stage");
      const cardEl = mk("div", "msui-dr-card" + (st.phase === "offer" ? " flip" : ""));
      const v = Math.round(c.value);
      cardEl.style.setProperty("--glow", v >= 8 ? "#fbbf24" : v >= 5 ? "#a78bfa" : "#64748b");
      cardEl.append(mk("div", "e", c.emoji), mk("div", "n", c.name));
      if (c.note) cardEl.appendChild(mk("div", "d", c.note));
      cardEl.appendChild(mk("div", "c", "Karte " + (st.i + 1) + " von " + deck.length));
      stage.appendChild(cardEl);

      const panel = mk("div", "msui-dr-panel");
      if (st.phase === "offer") {
        const t = st.turn;
        panel.appendChild(mk("div", "msui-dr-turn" + (t ? " bot" : ""), t ? "🤖 Mythos ist am Zug …" : "🙂 Du bist am Zug"));
        if (t === 0) {
          const bs = mk("div", "msui-btns");
          const tk = mk("button", "msui-btn msui-dr-main", "Nehmen für 1 €"); tk.type = "button"; tk.onclick = () => take(0);
          bs.appendChild(tk);
          if (st.p[0].gifts > 0 && open(1) > 0) { const gf = mk("button", "msui-btn", "🎁 Mythos schenken (" + st.p[0].gifts + "×)"); gf.type = "button"; gf.onclick = () => gift(0); bs.appendChild(gf); }
          panel.appendChild(bs);
        }
      } else {
        const bidEl = mk("div", "msui-dr-bid" + (lastFx === "bid" ? " pop" : ""));
        bidEl.append(mk("span", "l", "Höchstgebot"), mk("span", "v", st.bid + " €"), mk("span", "w", "von " + NAME[st.high]));
        panel.appendChild(bidEl);
        const me = st.toAct;
        panel.appendChild(mk("div", "msui-dr-turn" + (me ? " bot" : ""), me ? "🤖 Mythos überlegt …" : "🙂 Erhöhen oder passen?"));
        if (me === 0) {
          const bs = mk("div", "msui-btns"), mx = maxBid(0);
          [1, 2, 5].forEach((d) => { const amt = st.bid + d; if (amt > mx) return; const b = mk("button", "msui-btn msui-dr-main", amt + " €  (+" + d + ")"); b.type = "button"; b.onclick = () => raise(0, amt); bs.appendChild(b); });
          if (mx > st.bid + 5) { const all = mk("button", "msui-btn", "All-in " + mx + " €"); all.type = "button"; all.onclick = () => raise(0, mx); bs.appendChild(all); }
          const ps = mk("button", "msui-btn", "Passen"); ps.type = "button"; ps.onclick = () => pass(); bs.appendChild(ps);
          panel.appendChild(bs);
          if (mx <= st.bid) panel.appendChild(mk("div", "msui-mut", "Mehr geht nicht – du brauchst noch 1 € pro freiem Platz."));
        }
      }
      stage.appendChild(panel);
      box.appendChild(stage);
      if (st.log.length) { const lg = mk("div", "msui-dr-log"); st.log.slice(0, 3).forEach((l, k) => { const d = mk("div", "", l); if (!k) d.className = "new"; lg.appendChild(d); }); box.appendChild(lg); }
      const reset = mk("button", "msui-dr-reset", "Neu starten"); reset.type = "button";
      reset.onclick = () => { st = fresh(); save(); draw(); };
      box.appendChild(reset);
      // Mythos spielt mit kleiner Denkpause.
      if ((st.phase === "offer" && st.turn === 1) || (st.phase === "bid" && st.toAct === 1)) timer = setTimeout(() => { if (box.isConnected) botMove(); }, 900 + Math.random() * 700);
      lastFx = "";
    }
    draw();
    return box;
  }

  // ---------- Party-Spiele: Auswahl + Spielfeld (Mythos ist Spielleiter und spielt die anderen) ----------
  const MODEL_NAMES = ["Amber", "Bolt", "Spark", "Atlas", "Pebble"];
  const MODEL_COLOR = { Amber: "#f59e0b", Bolt: "#22d3ee", Spark: "#facc15", Atlas: "#34d399", Pebble: "#a8a29e", Du: "#a78bfa" };
  const GAMES = [
    { id: "imposter", emoji: "🕵️", title: "Imposter", text: "Einer kennt das Wort nicht und muss bluffen", min: 3 },
    { id: "werbinich", emoji: "🤔", title: "Wer bin ich?", text: "Errate, wer auf deiner Stirn steht", min: 2 },
    { id: "draft", emoji: "💶", title: "20-€-Draft", text: "Biete um die beste Aufstellung", min: 2, max: 2 },
  ];

  // ---------- Lokale Party-Spiele: laufen komplett im Baustein, Mitspieler-Züge holt die KI unsichtbar ----------
  const IMP_WORDS = [["Pizza","Essen"],["Strand","Ort"],["Gitarre","Instrument"],["Fahrrad","Fahrzeug"],["Zahnbürste","Alltag"],["Schule","Ort"],["Weihnachten","Fest"],["Hund","Tier"],["Minecraft","Spiel"],["Kino","Ort"],["Regenschirm","Gegenstand"],["Fußball","Sport"],["Kaffee","Getränk"],["Flugzeug","Fahrzeug"],["Eis","Essen"],["Zelt","Gegenstand"],["Krankenhaus","Ort"],["Smartphone","Technik"],["Pinguin","Tier"],["Schwimmbad","Ort"],["Geburtstag","Fest"],["Burger","Essen"],["Bibliothek","Ort"],["Schach","Spiel"],["Vulkan","Natur"],["Zug","Fahrzeug"],["Kühlschrank","Haushalt"],["Zahnarzt","Beruf"],["Feuerwehr","Beruf"],["Sonnenbrille","Gegenstand"],["Popcorn","Essen"],["Achterbahn","Freizeit"],["Bäckerei","Ort"],["Laptop","Technik"],["Hai","Tier"],["Karaoke","Freizeit"],["Kerze","Gegenstand"],["Tennis","Sport"],["Wüste","Natur"],["Pyjama","Kleidung"]];
  const WHO_CARDS = ["Albert Einstein","Pikachu","SpongeBob","Cristiano Ronaldo","Harry Potter","Mario","Taylor Swift","Batman","Elsa","Shrek","Lionel Messi","Darth Vader","Homer Simpson","Spider-Man","Angela Merkel","Steve aus Minecraft","Sonic","Elon Musk","Pippi Langstrumpf","Barbie","Goku","Michael Jackson","Kleopatra","Sherlock Holmes","Yoda","Pumuckl","Rapunzel","Napoleon","Mona Lisa","Bob der Baumeister","Garfield","Iron Man","Pocahontas","Lewis Hamilton","MrBeast","Dracula","Rotkäppchen","Thor","Super Mario Bowser","Benjamin Blümchen"];
  const pickN = (a, n) => [...a].sort(() => Math.random() - 0.5).slice(0, n);
  const askAI = async (prompt) => { const f = W.mythosAskHidden; if (typeof f !== "function") throw new Error("offline"); return await f(prompt); };
  const jsonOf = (t) => { const m = String(t || "").match(/\{[\s\S]*\}/); if (!m) return null; try { return JSON.parse(m[0]); } catch (e) { return null; } };
  const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9äöüß ]/g, " ").replace(/\s+/g, " ").trim();
  const FALLBACK_Q = ["Wie oft hast du damit zu tun?", "Wo würdest du das am ehesten finden?", "Ist das eher was für Kinder oder Erwachsene?", "Welche Farbe verbindest du damit?", "Würdest du das verschenken?", "Ist das eher laut oder leise?", "Braucht man dafür Geld?"];

  function localParty(gameId, nPlayers, nImp, key, ctx) {
    const box = mk("div", "msui-box msui-dr msui-pg");
    let st = store.get(key);
    if (!st || st.game !== gameId) {
      const names = ["Du"].concat(MODEL_NAMES.slice(0, nPlayers - 1));
      if (gameId === "imposter") {
        const [word, cat] = IMP_WORDS[Math.floor(Math.random() * IMP_WORDS.length)];
        st = { game: gameId, names, word, cat, imps: pickN(names, nImp), log: [], phase: "turn", asker: names[Math.floor(Math.random() * names.length)], askedBy: "", start: Date.now(), secs: 180, votes: null };
      } else {
        const cards = pickN(WHO_CARDS, names.length);
        st = { game: gameId, names, cards: Object.fromEntries(names.map((n, i) => [n, cards[i]])), log: [], phase: "turn", turn: 0, won: [] };
      }
      store.set(key, st);
    }
    const save = () => store.set(key, st);
    let busy = false, tick = 0, alive = true;
    const isImp = (n) => st.imps && st.imps.includes(n);
    const say = (from, to, q, a) => { st.log.push({ from, to, q, a }); save(); };

    async function botAskImposter(bot) {
      const targets = st.names.filter((n) => n !== bot && n !== st.askedBy);
      const fallback = { to: targets[Math.floor(Math.random() * targets.length)], q: FALLBACK_Q[Math.floor(Math.random() * FALLBACK_Q.length)] };
      try {
        const role = isImp(bot) ? "Du bist IMPOSTER und kennst das Wort NICHT (nur Kategorie „" + st.cat + "“) – frag so, dass du mehr erfährst, ohne aufzufallen." : "Das geheime Wort ist „" + st.word + "“. Frag unauffällig so, dass Wissende es erkennen, der Imposter aber nicht.";
        const r = jsonOf(await askAI("Imposter-Spiel. Du bist " + bot + ". " + role + "\nBisher: " + (st.log.slice(-6).map((l) => l.from + "→" + l.to + ": " + l.q + (l.a ? " / " + l.a : "")).join(" | ") || "nichts") + "\nWähle wen du fragst aus: " + targets.join(", ") + ". Antworte NUR als JSON: {\"to\":\"Name\",\"q\":\"kurze Frage, max 10 Wörter, ohne das Wort\"}"));
        if (r && targets.includes(r.to) && r.q) return { to: r.to, q: String(r.q).slice(0, 140) };
      } catch (e) { /* Fallback */ }
      return fallback;
    }
    async function botAnswerImposter(bot, q) {
      try {
        const role = isImp(bot) ? "Du bist IMPOSTER, kennst das Wort NICHT (Kategorie „" + st.cat + "“). Antworte vage aber glaubwürdig, damit du nicht auffällst." : "Das geheime Wort ist „" + st.word + "“. Antworte passend aber vage (nenne das Wort NIE), damit der Imposter es nicht errät.";
        const t = await askAI("Imposter-Spiel. Du bist " + bot + ". " + role + "\nFrage an dich: „" + q + "“\nAntworte in EINEM kurzen Satz (max 12 Wörter), ohne Anführungszeichen.");
        const a = String(t || "").split("\n")[0].replace(/^["„]|["“]$/g, "").trim();
        if (a && !norm(a).includes(norm(st.word))) return a.slice(0, 160);
      } catch (e) { /* Fallback */ }
      return ["Hmm, kommt drauf an, würde ich sagen.", "Eigentlich ziemlich oft, ehrlich gesagt.", "Puh, eher selten bei mir.", "Das verbinde ich mit guter Laune."][Math.floor(Math.random() * 4)];
    }
    async function botVotes() {
      const bots = st.names.filter((n) => n !== "Du");
      const out = {};
      try {
        const r = jsonOf(await askAI("Imposter-Spiel, Abstimmung. Wort: „" + st.word + "“. Imposter (geheim): " + st.imps.join(", ") + ". Verlauf: " + st.log.map((l) => l.from + "→" + l.to + ": " + l.q + " / " + (l.a || "")).join(" | ") + "\nStimme für jeden dieser Spieler ab: " + bots.join(", ") + ". Wissende stimmen meist für den Verdächtigsten (wer am vagesten/falschesten antwortete), Imposter lenken ab. Nicht für sich selbst. Antworte NUR als JSON: {\"Amber\":{\"vote\":\"Name\",\"why\":\"max 8 Wörter\"}, …}"));
        if (r) bots.forEach((b) => { const v = r[b]; if (v && st.names.includes(v.vote) && v.vote !== b) out[b] = { vote: v.vote, why: String(v.why || "").slice(0, 80) }; });
      } catch (e) { /* Fallback */ }
      bots.forEach((b) => { if (!out[b]) { const c = st.names.filter((n) => n !== b); out[b] = { vote: c[Math.floor(Math.random() * c.length)], why: "Bauchgefühl" }; } });
      return out;
    }

    async function botTurnWho(bot) {
      const mine = st.log.filter((l) => l.from === bot);
      try {
        const r = jsonOf(await askAI("„Wer bin ich?“-Spiel. Du bist " + bot + " und weißt NICHT, wer du bist. Deine bisherigen Fragen und die Antworten: " + (mine.map((l) => l.q + " → " + l.a).join(" | ") || "noch keine") + "\nStell die nächste kluge Ja/Nein-Frage über dich ODER rate, wenn du dir sicher bist. Antworte NUR als JSON: {\"q\":\"Bin ich …?\"} oder {\"guess\":\"Name\"}"));
        if (r && (r.q || r.guess)) return r;
      } catch (e) { /* Fallback */ }
      return { q: ["Bin ich ein Mensch?", "Bin ich echt (keine erfundene Figur)?", "Bin ich berühmt durch Sport?", "Komme ich aus einem Videospiel?", "Bin ich weiblich?", "Lebe ich noch?"][mine.length % 6] };
    }
    async function whoAnswer(q, card) {
      try {
        const t = await askAI("„Wer bin ich?“-Spiel. Die Figur ist „" + card + "“. Frage über die Figur: „" + q + "“. Antworte NUR mit Ja, Nein oder Teilweise und max. 5 Wörtern Zusatz.");
        const a = String(t || "").split("\n")[0].trim();
        if (a) return a.slice(0, 60);
      } catch (e) { /* Fallback */ }
      return "Hmm … teilweise.";
    }

    const avatars = () => {
      const row = mk("div", "msui-pg-players");
      st.names.forEach((n, i) => {
        const active = (st.game === "imposter" && st.phase === "turn" && n === st.asker) || (st.game === "werbinich" && st.phase === "turn" && st.names[st.turn] === n);
        const d = mk("div", "msui-pg-p" + (n === "Du" ? " me" : "") + (active ? " active" : "") + (st.won && st.won.includes(n) ? " out" : ""));
        d.style.setProperty("--c", MODEL_COLOR[n] || PALETTE[i % PALETTE.length]); d.style.animationDelay = i * 70 + "ms";
        d.append(mk("span", "av", n === "Du" ? "🙂" : n.slice(0, 1)), mk("span", "n", n));
        if (st.game === "werbinich" && n !== "Du") d.appendChild(mk("span", "c", st.cards[n]));
        if (st.phase === "over" && st.game === "imposter" && isImp(n)) d.appendChild(mk("span", "c", "😈 Imposter"));
        if (st.phase === "over" && st.game === "werbinich" && n === "Du") d.appendChild(mk("span", "c", st.cards.Du));
        if (busy && active && n !== "Du") d.appendChild(mk("span", "c", "denkt …"));
        row.appendChild(d);
      });
      return row;
    };

    function paint() {
      if (!box.isConnected && painted) { alive = false; clearInterval(tick); return; }
      box.replaceChildren();
      const tag = st.game === "imposter" ? "🕵️ Imposter" : "🤔 Wer bin ich?";
      box.appendChild(mk("div", "msui-dr-title", tag));
      // Rolle (verdeckt)
      if (st.phase !== "over") {
        const role = mk("div", "msui-pg-role" + (isImp("Du") ? " imp" : ""));
        if (st.game === "imposter") {
          if (isImp("Du")) role.append(mk("span", "k", "Du bist"), mk("b", "", "😈 IMPOSTER"), mk("span", "h", "Kategorie: " + st.cat + " – bluffe!"));
          else role.append(mk("span", "k", "Das geheime Wort"), mk("b", "", st.word), mk("span", "h", "Verrate es nicht zu deutlich!"));
        } else role.append(mk("span", "k", "Deine Karte"), mk("b", "", "❓ ???"), mk("span", "h", "Frag mit Ja/Nein-Fragen, wer du bist"));
        const wrap = mk("div", "msui-pg-rolewrap"); wrap.appendChild(role);
        if (!st.seen) { const veil = mk("button", "msui-pg-veil", "👁 Antippen zum Ansehen"); veil.type = "button"; veil.onclick = () => { st.seen = true; save(); veil.remove(); }; wrap.appendChild(veil); }
        box.appendChild(wrap);
      }
      box.appendChild(avatars());
      // Timer
      if (st.game === "imposter" && st.phase === "turn") {
        const t = mk("div", "msui-pg-timer"); const bar = mk("i"); t.append(mk("span", "", ""), bar); box.appendChild(t);
        const upd = () => {
          const left = Math.max(0, st.secs - Math.floor((Date.now() - st.start) / 1000));
          t.firstChild.textContent = "⏱ " + Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0");
          bar.style.width = (left / st.secs) * 100 + "%"; t.classList.toggle("low", left <= 30);
          if (!left && !busy) { clearInterval(tick); startVote(); }
        };
        clearInterval(tick); upd(); tick = setInterval(() => { if (!box.isConnected) { clearInterval(tick); return; } upd(); }, 1000);
      }
      // Verlauf
      if (st.log.length) {
        const lg = mk("div", "msui-pg-log");
        st.log.slice(-10).forEach((l, i, a) => {
          const it = mk("div", "msui-pg-li" + (i === a.length - 1 ? " new" : ""));
          const q = mk("div", "q"); q.append(mk("b", "", l.from + " → " + l.to + ": "), mk("span", "", l.q)); it.appendChild(q);
          if (l.a) { const a2 = mk("div", "a"); a2.append(mk("b", "", (st.game === "werbinich" ? "Antwort" : l.to) + ": "), mk("span", "", l.a)); it.appendChild(a2); }
          lg.appendChild(it);
        });
        box.appendChild(lg);
        requestAnimationFrame(() => { lg.scrollTop = lg.scrollHeight; });
      }
      const panel = mk("div", "msui-pg-panel"); box.appendChild(panel);
      if (st.phase === "over") return paintOver(panel);
      if (st.phase === "vote") return paintVote(panel);
      if (st.game === "imposter") paintImposter(panel); else paintWho(panel);
    }
    let painted = false;

    function paintImposter(panel) {
      const pending = st.pendingQ; // jemand hat dich gefragt
      if (busy) { panel.appendChild(mk("div", "msui-dr-turn bot", "🤖 " + (st.asker === "Du" ? "Antwort kommt" : st.asker + " ist dran"))); return; }
      if (st.asker !== "Du" && !pending) { runBots(); return; }
      if (pending) panel.appendChild(mk("div", "msui-dr-turn", pending.from + " fragt dich: „" + pending.q + "“"));
      else panel.appendChild(mk("div", "msui-dr-turn", "🙂 Du bist dran – frag jemanden"));
      const ans = mk("input", "msui-q-other"); ans.placeholder = "Deine Antwort (nicht zu eindeutig!)"; ans.enterKeyHint = "next";
      if (pending) panel.appendChild(ans);
      panel.appendChild(mk("div", "msui-mut", "Wen fragst du?" + (st.askedBy ? " (nicht " + st.askedBy + " – der hat dich gerade gefragt)" : "")));
      const sel = { v: "" }; const w = mk("div", "msui-btns");
      st.names.filter((n) => n !== "Du" && n !== st.askedBy).forEach((n) => { const b = mk("button", "msui-btn msui-pg-target", n); b.type = "button"; b.style.setProperty("--c", MODEL_COLOR[n]); b.onclick = () => { w.querySelectorAll("button").forEach((x) => x.classList.remove("on")); b.classList.add("on"); sel.v = n; }; w.appendChild(b); });
      panel.appendChild(w);
      const q = mk("input", "msui-q-other"); q.placeholder = "Deine Frage, z. B. „Wo findet man das?“"; q.enterKeyHint = "send"; panel.appendChild(q);
      const go = mk("button", "msui-q-send", pending ? "Antworten & fragen" : "Fragen"); go.type = "button";
      go.onclick = async () => {
        if (pending && !ans.value.trim()) { ans.focus(); return; }
        if (!sel.v) { w.classList.add("msui-pg-nudge"); setTimeout(() => w.classList.remove("msui-pg-nudge"), 500); return; }
        if (!q.value.trim()) { q.focus(); return; }
        if (pending) { st.log[st.log.length - 1].a = ans.value.trim(); st.pendingQ = null; }
        const target = sel.v, question = q.value.trim();
        say("Du", target, question, "");
        busy = true; st.asker = target; st.askedBy = "Du"; save(); paint();
        const a = await botAnswerImposter(target, question);
        st.log[st.log.length - 1].a = a; busy = false; save(); paint();
      };
      q.onkeydown = (e) => { if (e.key === "Enter") go.click(); };
      const vote = mk("button", "msui-btn", "🗳 Jetzt abstimmen"); vote.type = "button"; vote.onclick = () => startVote();
      const bw = mk("div", "msui-btns"); bw.append(go, vote); panel.appendChild(bw);
    }
    async function runBots() {
      if (busy || !alive) return;
      busy = true; paint();
      // Bots fragen sich durch, bis jemand den Spieler fragt (oder Zeit um)
      for (let guard = 0; guard < 4 && st.asker !== "Du" && st.phase === "turn"; guard++) {
        const bot = st.asker;
        const { to, q } = await botAskImposter(bot);
        if (!alive) return;
        say(bot, to, q, "");
        st.askedBy = bot;
        if (to === "Du") { st.pendingQ = { from: bot, q }; st.asker = "Du"; break; }
        paint();
        const a = await botAnswerImposter(to, q);
        st.log[st.log.length - 1].a = a; st.asker = to; save(); paint();
      }
      if (st.asker !== "Du" && st.phase === "turn") { // nach ein paar Bot-Runden ist der Spieler dran
        const bot = st.asker, q = (await botAskImposter(bot)).q;
        say(bot, "Du", q, ""); st.pendingQ = { from: bot, q }; st.askedBy = bot; st.asker = "Du";
      }
      busy = false; save(); paint();
    }
    function startVote() { if (st.phase !== "turn") return; st.phase = "vote"; save(); paint(); }
    function paintVote(panel) {
      panel.appendChild(mk("div", "msui-dr-turn", "🗳 Wer ist der Imposter?" + (st.imps.length > 1 ? " (" + st.imps.length + " Imposter)" : "")));
      const w = mk("div", "msui-btns msui-pg-vote");
      st.names.filter((n) => n !== "Du").forEach((n) => {
        const b = mk("button", "msui-btn msui-dr-main", "👉 " + n); b.type = "button";
        b.onclick = async () => {
          w.querySelectorAll("button").forEach((x) => (x.disabled = true));
          panel.appendChild(mk("div", "msui-dr-turn bot", "🤖 Die anderen stimmen ab"));
          const v = await botVotes(); v.Du = { vote: n, why: "" };
          const count = {}; Object.values(v).forEach((x) => (count[x.vote] = (count[x.vote] || 0) + 1));
          const top = Object.entries(count).sort((a, b) => b[1] - a[1]);
          const out = top[0] && (!top[1] || top[0][1] > top[1][1]) ? top[0][0] : null;
          st.votes = v; st.out = out; st.phase = "over";
          const caught = out && isImp(out);
          st.win = isImp("Du") ? !caught : !!caught;
          save(); paint();
        };
        w.appendChild(b);
      });
      panel.appendChild(w);
    }

    function paintWho(panel) {
      const cur = st.names[st.turn];
      if (busy) { panel.appendChild(mk("div", "msui-dr-turn bot", "🤖 " + cur + " überlegt")); return; }
      if (st.pendingWho) { // Bot fragt dich über seine Karte
        const p = st.pendingWho;
        panel.appendChild(mk("div", "msui-dr-turn", p.from + " fragt: „" + p.q + "“ (" + p.from + " ist " + st.cards[p.from] + ")"));
        const w = mk("div", "msui-btns");
        [["✅ Ja", "Ja"], ["❌ Nein", "Nein"], ["🤷 Teilweise", "Teilweise"]].forEach(([l, v]) => { const b = mk("button", "msui-btn msui-dr-main", l); b.type = "button"; b.onclick = () => { st.log[st.log.length - 1].a = v; st.pendingWho = null; nextWho(); }; w.appendChild(b); });
        panel.appendChild(w); return;
      }
      if (cur !== "Du") { runWhoBot(cur); return; }
      panel.appendChild(mk("div", "msui-dr-turn", "🙂 Du bist dran – Ja/Nein-Frage über dich oder raten"));
      const inp = mk("input", "msui-q-other"); inp.placeholder = "z. B. „Bin ich ein Mensch?“"; inp.enterKeyHint = "send";
      const g = mk("input", "msui-q-other"); g.placeholder = "Raten: „Bin ich …?“"; g.enterKeyHint = "send";
      const w = mk("div", "msui-btns");
      const b1 = mk("button", "msui-q-send", "Fragen"); b1.type = "button";
      b1.onclick = async () => { const v = inp.value.trim(); if (!v) return; say("Du", "alle", v, ""); busy = true; paint(); const a = await whoAnswer(v, st.cards.Du); st.log[st.log.length - 1].a = a; busy = false; nextWho(); };
      const b2 = mk("button", "msui-btn", "🎯 Raten"); b2.type = "button";
      b2.onclick = () => { const v = g.value.trim().replace(/^bin ich\s*/i, "").replace(/\?$/, ""); if (!v) return; const ok = norm(st.cards.Du).includes(norm(v)) || norm(v).includes(norm(st.cards.Du).split(" ").pop()); say("Du", "alle", "Bin ich " + v + "?", ok ? "✅ Richtig!" : "❌ Nein"); if (ok) { st.phase = "over"; st.win = true; st.winner = "Du"; save(); paint(); } else nextWho(); };
      inp.onkeydown = (e) => { if (e.key === "Enter") b1.click(); }; g.onkeydown = (e) => { if (e.key === "Enter") b2.click(); };
      w.append(b1, b2); panel.append(inp, g, w);
    }
    async function runWhoBot(bot) {
      if (busy || !alive) return;
      busy = true; paint();
      const r = await botTurnWho(bot);
      busy = false;
      if (!alive) return;
      if (r.guess) {
        const ok = norm(st.cards[bot]).includes(norm(r.guess)) || norm(r.guess).includes(norm(st.cards[bot]));
        say(bot, "alle", "Bin ich " + r.guess + "?", ok ? "✅ Richtig!" : "❌ Nein");
        if (ok) { st.phase = "over"; st.win = false; st.winner = bot; save(); paint(); return; }
        return nextWho();
      }
      say(bot, "Du", String(r.q).slice(0, 140), ""); st.pendingWho = { from: bot, q: r.q }; save(); paint();
    }
    function nextWho() { st.turn = (st.turn + 1) % st.names.length; save(); paint(); }

    function paintOver(panel) {
      const end = mk("div", "msui-dr-endbox");
      let title, text = "";
      if (st.game === "imposter") {
        title = st.win ? "🏆 Gewonnen!" : "💀 Verloren!";
        text = "Das Wort war „" + st.word + "“. Imposter: " + st.imps.join(", ") + ". " + (st.out ? st.out + " wurde rausgewählt." : "Gleichstand – niemand flog raus.");
        const rv = mk("div", "msui-pg-reveal");
        Object.entries(st.votes || {}).forEach(([n, v], i) => { const c = mk("div", "msui-pg-rc"); c.style.animationDelay = i * 150 + "ms"; c.append(mk("b", "", n + " → " + v.vote), mk("span", "", v.why || "")); rv.appendChild(c); });
        end.append(mk("div", "msui-dr-big", title), mk("div", "msui-sub", text), rv);
      } else {
        title = st.win ? "🏆 Du hast es erraten!" : "💀 " + st.winner + " war schneller!";
        text = "Du warst „" + st.cards.Du + "“.";
        end.append(mk("div", "msui-dr-big", title), mk("div", "msui-sub", text));
      }
      if (st.win) { const conf = mk("div", "msui-dr-confetti"); for (let k = 0; k < 28; k++) { const c = mk("i"); c.style.left = Math.random() * 100 + "%"; c.style.animationDelay = Math.random() * 0.6 + "s"; c.style.background = PALETTE[k % PALETTE.length]; conf.appendChild(c); } end.appendChild(conf); }
      const bs = mk("div", "msui-btns");
      const again = mk("button", "msui-btn msui-dr-main", "🔁 Nochmal"); again.type = "button";
      again.onclick = () => { const g = st.game, n = st.names.length, i = (st.imps || []).length || 1; store.set(key, null); const fresh = localParty(g, n, i, key, ctx); box.replaceWith(fresh); };
      bs.appendChild(again); end.appendChild(bs); panel.appendChild(end);
    }

    paint(); painted = true;
    return box;
  }

  // {"type":"gamesetup","game":"imposter","players":4}
  B.gamesetup = (s, ctx) => {
    const box = mk("div", "msui-box msui-dr");
    box.appendChild(mk("div", "msui-dr-title", s.title || "🎮 Welches Spiel?"));
    const key = "msui-gs-" + hash(JSON.stringify([s.id || "", s.title || ""]));
    const gkey = key + "-game";
    const running = store.get(gkey);
    if (running && running.game) return localParty(running.game, running.names.length, (running.imps || []).length || 1, gkey, ctx);
    const done = store.get(key);
    if (done) { const d = mk("div", "msui-q-done"); d.append(mk("span", "", "✓"), mk("span", "", done)); box.appendChild(d); return box; }
    let game = GAMES.find((g) => g.id === s.game) || GAMES[0], players = Math.max(2, Math.min(6, Number(s.players) || 4)), imp = 1;
    const grid = mk("div", "msui-dr-themes"), cfg = mk("div", "msui-gs-cfg");
    const draw = () => {
      if (game.max) players = Math.min(players, game.max);
      if (players < game.min) players = game.min;
      const maxImp = players >= 5 ? 2 : 1; imp = Math.min(Math.max(1, imp), maxImp);
      [...grid.children].forEach((b) => b.classList.toggle("on", b.dataset.id === game.id));
      cfg.replaceChildren();
      const row = (label, val, dec, inc, decOk, incOk) => {
        const r = mk("div", "msui-gs-row"); r.appendChild(mk("span", "", label));
        const st = mk("div", "msui-gs-step");
        const m = mk("button", "", "−"); m.type = "button"; m.disabled = !decOk; m.onclick = dec;
        const v = mk("b", "", String(val));
        const p = mk("button", "", "+"); p.type = "button"; p.disabled = !incOk; p.onclick = inc;
        st.append(m, v, p); r.appendChild(st); cfg.appendChild(r);
      };
      row("Spieler (mit dir)", players, () => { players--; draw(); }, () => { players++; draw(); }, players > game.min, players < (game.max || 6));
      if (game.id === "imposter") row("davon Imposter", imp, () => { imp--; draw(); }, () => { imp++; draw(); }, imp > 1, imp < (players >= 5 ? 2 : 1));
      const names = ["Du"].concat(MODEL_NAMES.slice(0, players - 1));
      const ppl = mk("div", "msui-gs-ppl"); names.forEach((n, i) => { const c = mk("span", "msui-gs-av", n); c.style.setProperty("--c", MODEL_COLOR[n] || "#a78bfa"); c.style.animationDelay = i * 60 + "ms"; ppl.appendChild(c); });
      cfg.appendChild(ppl);
      const go = mk("button", "msui-q-send", "▶ " + game.title + " starten"); go.type = "button";
      go.onclick = () => {
        // Imposter & Wer bin ich laufen direkt hier im Baustein weiter – keine Chat-Nachrichten.
        if (game.id !== "draft") { box.replaceWith(localParty(game.id, players, imp, gkey, ctx)); return; }
        const msg = game.id === "draft" ? "Lass uns das 20-€-Draft spielen – schlag mir 3 Themen vor."
          : "Starte " + game.title + " mit " + players + " Spielern (" + names.join(", ") + ")" + (game.id === "imposter" ? ", davon " + imp + " Imposter." : ".");
        store.set(key, game.title + (game.id === "draft" ? "" : " · " + players + " Spieler" + (game.id === "imposter" ? " · " + imp + " Imposter" : "")));
        ctx.send(msg);
        box.replaceChildren(mk("div", "msui-dr-title", "🎮 " + game.title)); const d = mk("div", "msui-q-done"); d.append(mk("span", "", "✓"), mk("span", "", store.get(key))); box.appendChild(d);
      };
      cfg.appendChild(go);
    };
    GAMES.forEach((g, i) => {
      const b = mk("button", "msui-dr-theme"); b.type = "button"; b.dataset.id = g.id; b.style.animationDelay = i * 90 + "ms";
      b.append(mk("span", "e", g.emoji), mk("span", "t", g.title), mk("span", "d", g.text));
      b.onclick = () => { game = g; draw(); };
      grid.appendChild(b);
    });
    box.append(grid, cfg); draw();
    return box;
  };
  B.spiele = B.gamesetup; B.games = B.gamesetup;

  // Spielfeld für Imposter / Wer bin ich – Mythos schickt nach jedem Zug den neuen Stand.
  // {"type":"partygame","game":"imposter","id":"imp1","players":[{"name":"Du","you":true},{"name":"Amber"}],
  //  "you":{"word":"Pizza"} | {"imposter":true,"hint":"Essen"},   (Wer bin ich: andere haben "card":"Einstein", du "card":"?")
  //  "log":[{"from":"Amber","to":"Bolt","q":"…","a":"…"}],
  //  "turn":{"action":"answer|ask|vote|yesno|guess|over","from":"Amber","question":"…"},
  //  "timer":180, "result":{"text":"…","reveal":[{"name":"Bolt","role":"Imposter"}]}}
  B.partygame = (s, ctx) => {
    const game = String(s.game || "imposter").toLowerCase().includes("wer") ? "werbinich" : "imposter";
    const id = String(s.id || game);
    const box = mk("div", "msui-box msui-dr msui-pg");
    const players = arr(s.players).map((p) => (typeof p === "string" ? { name: p } : p)).filter((p) => p && p.name);
    const me = players.find((p) => p.you) || players[0] || { name: "Du" };
    const others = players.filter((p) => p !== me);
    const turn = s.turn || {};
    const act = String(turn.action || "").toLowerCase();
    const tag = game === "imposter" ? "🕵️ Imposter" : "🤔 Wer bin ich?";
    const sentKey = "msui-pg-" + hash(JSON.stringify([id, s.log ? arr(s.log).length : 0, act, turn.question || ""]));
    const already = store.get(sentKey);
    const send = (text, label) => { store.set(sentKey, label || text); ctx.send(tag + " (" + id + "): " + text); paint(); };

    box.appendChild(mk("div", "msui-dr-title", tag));
    // Rolle des Spielers
    const you = s.you || {};
    const role = mk("div", "msui-pg-role" + (you.imposter ? " imp" : ""));
    if (game === "imposter") {
      if (you.imposter) role.append(mk("span", "k", "Du bist"), mk("b", "", "😈 IMPOSTER"), mk("span", "h", you.hint ? "Tipp: " + you.hint : "Du kennst das Wort nicht – bluffe!"));
      else role.append(mk("span", "k", "Das geheime Wort"), mk("b", "", you.word || "?"), mk("span", "h", "Verrate es nicht zu deutlich!"));
    } else role.append(mk("span", "k", "Deine Karte"), mk("b", "", "❓ ???"), mk("span", "h", "Frag mit Ja/Nein-Fragen, wer du bist"));
    // Schleier: Rolle erst beim Antippen zeigen (falls jemand mitschaut)
    const veil = mk("button", "msui-pg-veil", "👁 Antippen zum Ansehen"); veil.type = "button"; veil.onclick = () => veil.remove();
    const roleWrap = mk("div", "msui-pg-rolewrap"); roleWrap.append(role, veil); box.appendChild(roleWrap);

    // Spieler-Reihe
    const row = mk("div", "msui-pg-players");
    players.forEach((p, i) => {
      const d = mk("div", "msui-pg-p" + (p === me ? " me" : "") + (turn.from === p.name ? " active" : "") + (p.out ? " out" : ""));
      d.style.setProperty("--c", MODEL_COLOR[p.name] || PALETTE[i % PALETTE.length]); d.style.animationDelay = i * 70 + "ms";
      d.appendChild(mk("span", "av", p === me ? "🙂" : p.name.slice(0, 1)));
      d.appendChild(mk("span", "n", p === me ? "Du" : p.name));
      if (game === "werbinich" && p !== me && p.card) d.appendChild(mk("span", "c", p.card));
      row.appendChild(d);
    });
    box.appendChild(row);

    // Timer (Imposter: Standard 3 Minuten ab dem ersten Stand dieses Spiels)
    let timerEl = null, tick = 0;
    const secs = Number(s.timer) || (game === "imposter" ? 180 : 0);
    if (secs && act !== "over") {
      const tkey = "msui-pgt-" + hash(id + "|" + players.map((p) => p.name).join(","));
      let start = store.get(tkey); if (!start) { start = Date.now(); store.set(tkey, start); }
      timerEl = mk("div", "msui-pg-timer");
      const bar = mk("i"); timerEl.append(mk("span", "t", ""), bar);
      const upd = () => {
        const left = Math.max(0, secs - Math.floor((Date.now() - start) / 1000));
        timerEl.firstChild.textContent = left ? "⏱ " + Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0") : "⏰ Zeit um – abstimmen!";
        bar.style.width = (left / secs) * 100 + "%";
        timerEl.classList.toggle("low", left <= 30);
        if (!left && act !== "vote" && !box.querySelector(".msui-pg-vote") && !already) { clearInterval(tick); paintVote(true); }
        if (!box.isConnected && tick) clearInterval(tick);
      };
      box.appendChild(timerEl); upd(); tick = setInterval(upd, 1000);
    }

    // Verlauf
    const log = arr(s.log);
    if (log.length) {
      const lg = mk("div", "msui-pg-log");
      log.slice(-8).forEach((l, i, a) => {
        const it = mk("div", "msui-pg-li" + (i === a.length - 1 ? " new" : ""));
        if (l.q) { const q = mk("div", "q"); q.append(mk("b", "", (l.from || "?") + " → " + (l.to || "?") + ": "), mk("span", "", l.q)); it.appendChild(q); }
        if (l.a) { const a2 = mk("div", "a"); a2.append(mk("b", "", (l.to || "") + ": "), mk("span", "", l.a)); it.appendChild(a2); }
        if (l.text) it.appendChild(mk("div", "q", l.text));
        lg.appendChild(it);
      });
      box.appendChild(lg);
    }

    const panel = mk("div", "msui-pg-panel"); box.appendChild(panel);
    const targetPicker = (sel) => {
      const w = mk("div", "msui-btns");
      others.forEach((p) => { const b = mk("button", "msui-btn msui-pg-target", p.name); b.type = "button"; b.style.setProperty("--c", MODEL_COLOR[p.name] || "#a78bfa"); b.onclick = () => { w.querySelectorAll("button").forEach((x) => x.classList.remove("on")); b.classList.add("on"); sel.v = p.name; }; w.appendChild(b); });
      return w;
    };
    function paintVote(timeUp) {
      panel.replaceChildren();
      panel.appendChild(mk("div", "msui-dr-turn", timeUp ? "⏰ Zeit um! Wer ist der Imposter?" : "🗳 Wer ist der Imposter?"));
      const w = mk("div", "msui-btns msui-pg-vote");
      others.forEach((p) => { const b = mk("button", "msui-btn msui-dr-main", "👉 " + p.name); b.type = "button"; b.onclick = () => send("Zeit um – ich stimme für " + p.name + ". Lass jetzt alle anderen abstimmen und löse auf.", "Gestimmt für " + p.name); w.appendChild(b); });
      panel.appendChild(w);
    }
    function paint() {
      panel.replaceChildren();
      const done = store.get(sentKey);
      if (done) { const d = mk("div", "msui-q-done"); d.append(mk("span", "", "✓"), mk("span", "", done)); panel.appendChild(d); return; }
      if (act === "over" || s.result) {
        const r = s.result || {};
        const end = mk("div", "msui-dr-endbox");
        end.appendChild(mk("div", "msui-dr-big", r.title || (r.win === true ? "🏆 Gewonnen!" : r.win === false ? "💀 Verloren!" : "🏁 Spiel vorbei")));
        if (r.text) end.appendChild(mk("div", "msui-sub", r.text));
        if (arr(r.reveal).length) { const rv = mk("div", "msui-pg-reveal"); arr(r.reveal).forEach((x, i) => { const c = mk("div", "msui-pg-rc"); c.style.animationDelay = i * 150 + "ms"; c.append(mk("b", "", x.name), mk("span", "", x.role || x.card || "")); rv.appendChild(c); }); end.appendChild(rv); }
        if (r.win === true) { const conf = mk("div", "msui-dr-confetti"); for (let k = 0; k < 28; k++) { const c = mk("i"); c.style.left = Math.random() * 100 + "%"; c.style.animationDelay = Math.random() * 0.6 + "s"; c.style.background = PALETTE[k % PALETTE.length]; conf.appendChild(c); } end.appendChild(conf); }
        const bs = mk("div", "msui-btns");
        const again = mk("button", "msui-btn msui-dr-main", "🔁 Nochmal"); again.type = "button"; again.onclick = () => ctx.send("Nochmal " + (game === "imposter" ? "Imposter" : "Wer bin ich") + " mit denselben Spielern!");
        const other = mk("button", "msui-btn", "🎮 Anderes Spiel"); other.type = "button"; other.onclick = () => ctx.send("Lass uns ein anderes Spiel spielen.");
        bs.append(again, other); end.appendChild(bs); panel.appendChild(end);
        return;
      }
      if (act === "vote") return paintVote(false);
      if (act === "yesno") { // Wer bin ich: ein Mitspieler fragt dich etwas über SEINE Karte
        panel.appendChild(mk("div", "msui-dr-turn", (turn.from || "Jemand") + " fragt: „" + (turn.question || "?") + "“"));
        const w = mk("div", "msui-btns");
        [["✅ Ja", "Ja"], ["❌ Nein", "Nein"], ["🤷 Weiß nicht", "Weiß ich nicht"]].forEach(([l, v]) => { const b = mk("button", "msui-btn msui-dr-main", l); b.type = "button"; b.onclick = () => send("Meine Antwort an " + (turn.from || "") + ": " + v + ".", l); w.appendChild(b); });
        panel.appendChild(w); return;
      }
      if (game === "werbinich" && (act === "ask" || act === "guess" || !act)) {
        panel.appendChild(mk("div", "msui-dr-turn", "🙂 Du bist dran – stell eine Ja/Nein-Frage über dich"));
        const inp = mk("input", "msui-q-other"); inp.placeholder = "z. B. „Bin ich ein Mensch?“";
        const g = mk("input", "msui-q-other"); g.placeholder = "Oder raten: „Bin ich …?“";
        const w = mk("div", "msui-btns");
        const b1 = mk("button", "msui-q-send", "Fragen"); b1.type = "button"; b1.onclick = () => { const v = inp.value.trim(); if (v) send("Meine Frage über mich: „" + v + "“", "Gefragt: " + v); };
        const b2 = mk("button", "msui-btn", "🎯 Raten"); b2.type = "button"; b2.onclick = () => { const v = g.value.trim(); if (v) send("Ich rate: Bin ich " + v.replace(/^bin ich\s*/i, "").replace(/\?$/, "") + "?", "Geraten: " + v); };
        inp.onkeydown = (e) => { if (e.key === "Enter") b1.click(); }; g.onkeydown = (e) => { if (e.key === "Enter") b2.click(); };
        w.append(b1, b2); panel.append(inp, g, w); return;
      }
      // Imposter: antworten (falls gefragt) und dann selbst jemanden fragen
      const asked = act === "answer";
      if (asked) panel.appendChild(mk("div", "msui-dr-turn", (turn.from || "Jemand") + " fragt dich: „" + (turn.question || "?") + "“"));
      else panel.appendChild(mk("div", "msui-dr-turn", "🙂 Du bist dran – frag jemanden"));
      const ans = mk("input", "msui-q-other"); ans.placeholder = "Deine Antwort (nicht zu eindeutig!)";
      if (asked) panel.appendChild(ans);
      panel.appendChild(mk("div", "msui-mut", "Wen fragst du als Nächstes?"));
      const sel = { v: "" }; panel.appendChild(targetPicker(sel));
      const q = mk("input", "msui-q-other"); q.placeholder = "Deine Frage, z. B. „Wo findet man das?“";
      panel.appendChild(q);
      const go = mk("button", "msui-q-send", asked ? "Antworten & fragen" : "Fragen"); go.type = "button";
      go.onclick = () => {
        if (asked && !ans.value.trim()) { ans.focus(); return; }
        if (!sel.v || !q.value.trim()) { (sel.v ? q : panel).focus?.(); return; }
        send((asked ? "Meine Antwort: „" + ans.value.trim() + "“. " : "") + "Ich frage " + sel.v + ": „" + q.value.trim() + "“", (asked ? "Geantwortet & " : "") + sel.v + " gefragt");
      };
      const vote = mk("button", "msui-btn", "🗳 Jetzt abstimmen"); vote.type = "button"; vote.onclick = () => paintVote(false);
      const w = mk("div", "msui-btns"); w.append(go, vote); panel.appendChild(w);
    }
    paint();
    return box;
  };
  B.imposter = (s, ctx) => B.partygame(Object.assign({ game: "imposter" }, s), ctx);
  B.werbinich = (s, ctx) => B.partygame(Object.assign({ game: "werbinich" }, s), ctx);

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
    "- choice: {\"type\":\"choice\",\"title\":\"…\",\"label\":\"…\",\"options\":[{\"label\":\"…\",\"text\":\"…\"}]} – Optionen ansehen und vergleichen; hat einen Knopf „Weiter mit …“, der die Wahl an dich zurückschickt. Willst du nur etwas FRAGEN, nimm question.\n" +
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
    "- draft (20-€-Draft, Bietspiel gegen dich): Will jemand das „20-€-Spiel“/„20-Dollar-Draft“ spielen, schlage ZUERST 3 Themen vor: {\"type\":\"draft\",\"themes\":[{\"title\":\"Fußball-Startelf\",\"emoji\":\"⚽\",\"text\":\"kurz\"},{…},{…}]} (der Nutzer kann auch eigenes Thema eingeben). " +
    "Kommt „Starte das 20-€-Draft mit dem Thema „X““, antworte mit EINEM Satz und dem Spiel: {\"type\":\"draft\",\"theme\":\"X\",\"emoji\":\"🍔\",\"budget\":20,\"slots\":5,\"deck\":[{\"name\":\"Wagyu-Patty\",\"emoji\":\"🥩\",\"value\":9,\"note\":\"kurzer Witz/Fakt\"}, …]} " +
    "mit 14 Karten in zufälliger Reihenfolge: konkrete, echte Dinge/Personen zum Thema, gemischt von Top (value 8-10) über solide bis schwach/witzig (1-3). Das Spiel läuft komplett in der Oberfläche – erkläre keine Regeln und biete nicht selbst im Text.\n" +
    "- SPIELE: Du kannst mit dem Nutzer Party-Spiele spielen und bist dabei Spielleiter. Will jemand „ein Spiel spielen“, zeig zuerst die Auswahl {\"type\":\"gamesetup\"} (Wer bin ich?, Imposter, 20-€-Draft; 2–6 Spieler, Imposter ab 3; 1 Imposter bei 3–4, bis 2 bei 5–6). " +
    "Imposter und Wer bin ich? laufen danach KOMPLETT im Baustein (Mitspieler Amber, Bolt, Spark, Atlas, Pebble werden automatisch gespielt) – du musst nichts weiter tun, keine Regeln erklären. Antworte also nur mit einem kurzen Satz + {\"type\":\"gamesetup\"}.\n" +
    "- partygame (Imposter/Wer bin ich): {\"type\":\"partygame\",\"game\":\"imposter|werbinich\",\"id\":\"fest-pro-runde\",\"players\":[{\"name\":\"Du\",\"you\":true},{\"name\":\"Amber\",\"card\":\"nur bei Wer bin ich: Figur\"}],\"you\":{\"word\":\"Pizza\"} oder {\"imposter\":true,\"hint\":\"Essen\"},\"log\":[{\"from\":\"Amber\",\"to\":\"Bolt\",\"q\":\"…\",\"a\":\"…\"}],\"turn\":{\"action\":\"answer|ask|vote|yesno|over\",\"from\":\"Amber\",\"question\":\"…\"},\"timer\":180,\"result\":{\"win\":true,\"text\":\"…\",\"reveal\":[{\"name\":\"Bolt\",\"role\":\"Imposter\"}]}}. " +
    "IMPOSTER: Alle außer den Imposter(n) kennen dasselbe geheime Wort; Imposter bekommen nur eine Kategorie als Tipp. Ist der Nutzer Imposter, steht das Wort NIRGENDS im Baustein. Ein Spieler fragt einen anderen etwas Unauffälliges, der antwortet (vage, ohne das Wort) und fragt den Nächsten. " +
    "Spiele die Bot-Züge selbst im log aus, bis der Nutzer dran ist (turn.action answer = er wurde gefragt, ask = er darf fragen). Nach 3 Minuten (timer) oder wenn der Nutzer abstimmt: alle stimmen ab (Bots begründen kurz), dann auflösen mit result. Merke dir Wort und Imposter über alle Züge gleich. " +
    "WER BIN ICH: Jeder hat eine bekannte Figur, die alle außer ihm selbst sehen (players[].card; beim Nutzer \"?\"). Der Nutzer stellt Ja/Nein-Fragen über sich – antworte als die Mitspieler ehrlich im log; Bots fragen den Nutzer über ihre eigene Karte (turn.action yesno). Wer richtig rät, gewinnt. " +
    "Die id bleibt pro Runde gleich; keine Regeln lang erklären.\n" +
    "- buttons: {\"type\":\"buttons\",\"items\":[{\"label\":\"Kürzer\",\"prompt\":\"Mach es kürzer\"}]} – nächste Schritte per Klick (gut am Ende).\n" +
    "Beispiele: „Vergleiche X und Y“ → compare mit Bildern; „Rechner für …“ → calculator; „Erkläre Pythagoras“ → formula + calculator mit svg-Dreieck; " +
    "„Plane einen Ausflug“ → map + timeline + checklist; „Zeig Entwicklung meiner Ausgaben“ → chart; „Lernplan/Quiz“ → steps/quiz. " +
    "Für ganze Spiele oder Apps weiterhin eine ```datei:spiel.html``` schicken.";

  W.MythosSmartUI = { render, parse, PROMPT, LANG: "mythos-ui" };
})();
