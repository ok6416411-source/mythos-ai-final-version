import { lazy, Suspense, useState } from "react";
import { ExternalLink, RotateCw, Share2, X, Code2, Eye, Check } from "lucide-react";
import { toast } from "sonner";
import type { PreviewItem } from "@/lib/livePreview";
import { previewDoc, shareResult } from "@/lib/share";
import { openInMythosBrowser } from "@/components/EmbeddedBrowser";

const BBModelViewer = lazy(() => import("@/components/preview/BBModelViewer"));

/** Live-Vorschau rechts neben dem Chat: das Ergebnis läuft sofort und aktualisiert sich mit jeder neuen Version. */
export default function LivePreview({ item, prompt, onClose }: { item: PreviewItem; prompt?: string; onClose: () => void }) {
  const [nonce, setNonce] = useState(0);
  const [code, setCode] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const doc = item.kind === "bbmodel" ? "" : previewDoc(item.name, item.content);

  const openTab = () => {
    if (item.kind !== "bbmodel") return openInMythosBrowser({ html: doc || item.content, title: item.name });
    const u = URL.createObjectURL(new Blob([item.content], { type: "application/json" })); window.open(u, "_blank");
  };
  const share = async (gallery: boolean) => {
    setSharing(true);
    try {
      const url = await shareResult({ name: item.name, content: item.content, title: item.name.replace(/\.[^.]+$/, ""), prompt, gallery });
      setShared(true); setTimeout(() => setShared(false), 2500);
      toast.success(gallery ? "Geteilt und in der Galerie veröffentlicht – Link kopiert" : "Link kopiert", { description: url });
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setSharing(false); }
  };
  const Btn = ({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) => (
    <button type="button" title={title} onClick={onClick} className="rounded-lg p-2 text-muted-foreground hover:bg-white/5 hover:text-foreground">{children}</button>
  );

  return (
    <aside className="hidden lg:flex w-[min(46vw,760px)] shrink-0 flex-col border-l border-border bg-background/60 backdrop-blur-xl animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center gap-1 border-b border-border px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.7)]" />
        <span className="ml-1.5 min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
        <span className="mr-1 text-[11px] text-muted-foreground">Live-Vorschau</span>
        <Btn title={code ? "Vorschau" : "Code"} onClick={() => setCode(!code)}>{code ? <Eye className="h-4 w-4" /> : <Code2 className="h-4 w-4" />}</Btn>
        <Btn title="Neu laden" onClick={() => setNonce(nonce + 1)}><RotateCw className="h-4 w-4" /></Btn>
        <Btn title="Groß öffnen" onClick={openTab}><ExternalLink className="h-4 w-4" /></Btn>
        <button type="button" disabled={sharing} onClick={() => share(false)} title="Link zum Teilen kopieren"
          className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50">
          {shared ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />} Teilen
        </button>
        <button type="button" disabled={sharing} onClick={() => share(true)} title="Teilen und in der öffentlichen Galerie zeigen" className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">Galerie</button>
        <Btn title="Schließen (Strg+.)" onClick={onClose}><X className="h-4 w-4" /></Btn>
      </div>
      <div className="relative min-h-0 flex-1">
        {code ? (
          <pre className="h-full overflow-auto p-4 font-mono text-xs leading-relaxed text-foreground/85">{item.content}</pre>
        ) : item.kind === "bbmodel" ? (
          <Suspense fallback={<div className="h-full animate-pulse bg-white/[0.03]" />}><BBModelViewer json={item.content} /></Suspense>
        ) : (
          <iframe key={item.key + nonce} title="Live-Vorschau" srcDoc={doc} sandbox="allow-scripts allow-pointer-lock allow-popups allow-forms allow-modals" allow="fullscreen; autoplay; gamepad" className="h-full w-full border-0 bg-white" />
        )}
      </div>
    </aside>
  );
}
