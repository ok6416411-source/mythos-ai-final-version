import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/** In der abgeschotteten Ansicht fehlt localStorage – Ersatz im Speicher, damit Apps nicht abstürzen. */
const SHIM = `<script>try{localStorage.length}catch(e){var m={},s={getItem:function(k){return k in m?m[k]:null},setItem:function(k,v){m[k]=String(v)},removeItem:function(k){delete m[k]},clear:function(){m={}},key:function(i){return Object.keys(m)[i]||null}};Object.defineProperty(s,"length",{get:function(){return Object.keys(m).length}});try{Object.defineProperty(window,"localStorage",{value:s});Object.defineProperty(window,"sessionStorage",{value:s})}catch(e2){}}</script>`;
const withShim = (h: string) => (/<head[^>]*>/i.test(h) ? h.replace(/<head[^>]*>/i, (t) => t + SHIM) : SHIM + h);

/** Öffentliche Seite einer veröffentlichten App: /build/<name> – ohne Anmeldung, bildschirmfüllend. */
export default function PublishedApp() {
  const { slug } = useParams();
  const [html, setHtml] = useState<string | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let dead = false;
    setHtml(null); setErr("");
    supabase.functions.invoke("labs", { body: { kind: "app_get", slug } }).then(async ({ data, error }) => {
      if (dead) return;
      if (data?.item?.html) { setHtml(data.item.html); document.title = data.item.title || String(slug); return; }
      let msg = data?.error as string | undefined;
      const ctx = (error as { context?: Response } | null)?.context;
      if (!msg && ctx && typeof ctx.json === "function") msg = (await ctx.json().catch(() => null))?.error;
      setErr(msg || "Diese App gibt es nicht.");
    });
    return () => { dead = true; };
  }, [slug]);

  if (err) return (
    <div className="grid h-[100dvh] place-items-center bg-[#0b0d12] px-6 text-center text-white">
      <div>
        <p className="text-lg font-medium">{err}</p>
        <p className="mt-1 text-sm text-white/50">/build/{slug}</p>
        <Link to="/build" className="mt-5 inline-block rounded-full bg-white px-4 py-2 text-sm font-medium text-black">Eigene App mit Mythos bauen</Link>
      </div>
    </div>
  );
  if (html == null) return <div className="h-[100dvh] animate-pulse bg-[#0b0d12]" aria-busy="true" />;
  return (
    <div className="relative h-[100dvh] bg-white">
      <iframe title={document.title} srcDoc={withShim(html)} sandbox="allow-scripts allow-forms allow-popups allow-modals allow-pointer-lock allow-downloads" allow="fullscreen; autoplay; gamepad; clipboard-write" className="h-full w-full border-0" />
      <Link to="/build" className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2.5 py-1 text-[11px] text-white/80 backdrop-blur hover:text-white">Mit Mythos gebaut</Link>
    </div>
  );
}
