import { useEffect, useState } from "react";
import { ArrowUpRight, Globe, RotateCw, X } from "lucide-react";

/** Eingebetteter Mythos-Browser: HTML-Apps, Spiele und Seiten öffnen sich hier statt in einem neuen Tab. */
export type BrowserOpen = { html?: string; url?: string; title?: string };
export const openInMythosBrowser = (o: BrowserOpen) => window.dispatchEvent(new CustomEvent<BrowserOpen>("mythos-browser", { detail: o }));

export default function EmbeddedBrowser() {
  const [page, setPage] = useState<BrowserOpen | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const on = (e: Event) => { setPage((e as CustomEvent<BrowserOpen>).detail); setNonce((n) => n + 1); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setPage(null); };
    window.addEventListener("mythos-browser", on);
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("mythos-browser", on); window.removeEventListener("keydown", esc); };
  }, []);
  if (!page) return null;
  const external = () => {
    const u = page.url || URL.createObjectURL(new Blob([page.html || ""], { type: "text/html;charset=utf-8" }));
    window.open(u, "_blank", "noopener");
  };
  const label = page.title || (page.url ? new URL(page.url, location.href).host : "App");
  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/60 backdrop-blur-sm sm:p-6 animate-in fade-in duration-200" onClick={() => setPage(null)}>
      <div className="flex w-full max-w-6xl flex-col overflow-hidden bg-background sm:rounded-2xl sm:border sm:border-white/10 shadow-2xl pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1 border-b border-white/10 px-2 py-1.5">
          <button onClick={() => setPage(null)} className="rounded-lg p-2 text-muted-foreground hover:bg-white/5 hover:text-foreground" title="Schließen" aria-label="Schließen"><X className="h-4 w-4" /></button>
          <div className="mx-1 flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1.5 text-sm">
            <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{label}</span>
          </div>
          <button onClick={() => setNonce((n) => n + 1)} className="rounded-lg p-2 text-muted-foreground hover:bg-white/5 hover:text-foreground" title="Neu laden" aria-label="Neu laden"><RotateCw className="h-4 w-4" /></button>
          <button onClick={external} className="rounded-lg p-2 text-muted-foreground hover:bg-white/5 hover:text-foreground" title="Extern öffnen" aria-label="Extern öffnen"><ArrowUpRight className="h-4 w-4" /></button>
        </div>
        <iframe
          key={nonce}
          title={label}
          className="min-h-0 flex-1 bg-white"
          sandbox="allow-scripts allow-forms allow-modals allow-pointer-lock allow-popups allow-downloads"
          allow="fullscreen; autoplay; gamepad; accelerometer; gyroscope"
          {...(page.html != null ? { srcDoc: page.html } : { src: page.url })}
        />
      </div>
    </div>
  );
}
