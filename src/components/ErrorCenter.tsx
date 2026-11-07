import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Copy, Check, RotateCw } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { copyText } from "@/lib/copyText";

type Err = { title: string; detail: string; at: string };
let patched = false;

/** Fehler nicht nur als roter Text: jede Fehlermeldung bekommt „Details“, die ein richtiges Fenster öffnet. */
export default function ErrorCenter() {
  const [err, setErr] = useState<Err | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (patched) return; patched = true;
    const orig = toast.error;
    (toast as { error: typeof toast.error }).error = ((msg: unknown, opts?: Record<string, unknown>) => {
      const title = typeof msg === "string" ? msg : "Etwas ist schiefgelaufen";
      const detail = [opts?.description, typeof msg === "string" ? "" : String(msg ?? "")].filter(Boolean).join("\n");
      const info: Err = { title, detail: detail || title, at: new Date().toLocaleString("de-DE") };
      return orig(title, { ...opts, action: (opts?.action as any) ?? { label: "Details", onClick: () => setErr(info) } });
    }) as typeof toast.error;
    const onRejected = (e: PromiseRejectionEvent) => { const m = e.reason instanceof Error ? e.reason.message : String(e.reason ?? ""); if (/ChunkLoadError|Failed to fetch dynamically imported module/i.test(m)) setErr({ title: "Neue Version verfügbar", detail: "Ein Teil der App wurde aktualisiert. Bitte einmal neu laden.", at: new Date().toLocaleString("de-DE") }); };
    window.addEventListener("unhandledrejection", onRejected);
    return () => window.removeEventListener("unhandledrejection", onRejected);
  }, []);
  return (
    <Dialog open={!!err} onOpenChange={(o) => { if (!o) setErr(null); }}>
      <DialogContent className="max-w-md">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-500/10 text-red-400"><AlertTriangle className="h-5 w-5" /></div>
          <div className="min-w-0">
            <DialogTitle className="text-base">{err?.title}</DialogTitle>
            <DialogDescription className="mt-1 text-xs">{err?.at}</DialogDescription>
          </div>
        </div>
        <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-muted/40 p-3 font-mono text-xs text-foreground/80">{err?.detail}</pre>
        <p className="text-xs text-muted-foreground">Meist hilft: kurz warten und nochmal versuchen. Bleibt der Fehler, kopiere die Details und schick sie dem Support.</p>
        <div className="flex justify-end gap-2">
          <button onClick={async () => { await copyText(`${err?.title}\n${err?.detail}\n${err?.at}\n${location.href}`); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-sm hover:bg-muted">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Details kopieren
          </button>
          <button onClick={() => location.reload()} className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-2 text-sm text-background hover:opacity-90"><RotateCw className="h-4 w-4" /> Neu laden</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
