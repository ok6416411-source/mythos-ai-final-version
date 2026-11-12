import { useEffect, useMemo, useState } from "react";
import { openInMythosBrowser } from "@/components/EmbeddedBrowser";
import { closePartialSvg } from "@/lib/grafik";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, Download, Play, FileArchive, FileText, FileCode2, FileImage, FileSpreadsheet, Box, Loader2 } from "lucide-react";
import JSZip from "jszip";
import { toast } from "sonner";
import { copyText } from "@/lib/copyText";
import SmartUI from "@/components/chat/SmartUI";
import { parseFileInfo, fileBlob, saveBlob, fmtSize, extOf, isImageName } from "@/lib/chatFiles";
import { finishBBModel } from "@/lib/bbmodel";
import { splitFiles, prepareFile } from "@/lib/chatFileParts";
import FileViewer, { type ViewFile } from "@/components/chat/FileViewer";

const EXT: Record<string, string> = {
  html: "html", xml: "xml", javascript: "js", js: "js", jsx: "jsx", typescript: "ts", ts: "ts",
  tsx: "tsx", python: "py", py: "py", java: "java", json: "json", css: "css", scss: "scss",
  bash: "sh", sh: "sh", shell: "sh", yaml: "yml", yml: "yml", sql: "sql", md: "md",
  markdown: "md", csv: "csv", php: "php", go: "go", rust: "rs", rs: "rs", c: "c", cpp: "cpp",
  cs: "cs", kotlin: "kt", swift: "swift", toml: "toml", ini: "ini", txt: "txt",
};

function download(name: string, content: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function IconBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="rounded-md border border-white/10 bg-background/60 p-2 sm:p-1.5 touch-manipulation text-muted-foreground backdrop-blur transition-colors hover:text-foreground hover:bg-white/10"
    >
      {children}
    </button>
  );
}

/** Extract fenced blocks from raw markdown, for the "alles als ZIP" action. */
function extractBlocks(md: string) {
  const out: { lang: string; code: string; name: string; base64: boolean; isFile: boolean }[] = [];
  const re = /```([^\s`]*)[^\n]*\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  let i = 1;
  while ((m = re.exec(md))) {
    if (/^mythos-ui$/i.test(m[1])) continue;
    const file = parseFileInfo(m[1]);
    const lang = (m[1] || "txt").toLowerCase();
    const named = /^(?:\/\/|#|<!--)\s*([\w.\-/]+\.[a-zA-Z0-9]{1,12})/.exec(m[2].trim());
    out.push({
      lang,
      code: m[2].replace(/\n$/, ""),
      name: file?.name || named?.[1] || `datei-${i}.${EXT[lang] || "txt"}`,
      base64: !!file?.base64,
      isFile: !!file,
    });
    i++;
  }
  return out;
}

const fileIcon = (name: string) => {
  const e = extOf(name);
  if (isImageName(name)) return FileImage;
  if (e === "csv" || e === "tsv" || e === "xlsx") return FileSpreadsheet;
  if (e === "md" || e === "txt" || e === "pdf" || e === "docx") return FileText;
  return FileCode2;
};

/** Eine Datei, die Mythos geschickt hat: kompakte Karte, Klick öffnet das Datei-Fenster. */
function FileCard({ name, content, base64, onOpen }: { name: string; content: string; base64: boolean; onOpen: (f: ViewFile) => void }) {
  const prep = useMemo(() => prepareFile(name, content, base64), [name, content, base64]);
  const e = extOf(name);
  const Icon = e === "bbmodel" ? Box : fileIcon(name);
  const open = () => onOpen({ name, content: prep.content, base64, blob: prep.blob, note: prep.note });
  return (
    <div className="group/file not-prose flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:border-foreground/25">
      <button type="button" onClick={open} className="flex min-w-0 flex-1 items-center gap-3 text-left" title="Datei öffnen">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50 text-muted-foreground"><Icon className="h-[18px] w-[18px]" /></div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium" title={name}>{name.split("/").pop()}</div>
          <div className={`truncate text-[11.5px] ${prep.error ? "text-destructive" : "text-muted-foreground"}`}>
            {prep.error ? prep.error : `${e.toUpperCase() || "Datei"}${prep.blob ? ` · ${fmtSize(prep.blob.size)}` : ""}${prep.note ? ` · ${prep.note}` : ""} · Klicken zum Öffnen`}
          </div>
        </div>
      </button>
      <button
        type="button"
        disabled={!prep.blob}
        onClick={() => prep.blob && saveBlob(name, prep.blob)}
        title="Herunterladen"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-40"
      >
        <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Download</span>
      </button>
    </div>
  );
}

function WritingCard({ name, lines }: { name: string; lines: number }) {
  return (
    <div className="not-prose flex items-center gap-3 rounded-xl border border-dashed border-border px-3 py-2.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/50"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{name.split("/").pop()}</div>
        <div className="text-[11.5px] text-muted-foreground">wird geschrieben … {lines} Zeilen</div>
      </div>
    </div>
  );
}

/** Grafik entsteht live: das unfertige SVG wird laufend geschlossen und angezeigt, dazu ein Fortschritt. */
function SvgDrawing({ code }: { code: string }) {
  const [url, setUrl] = useState("");
  const shapes = (code.match(/<(path|rect|circle|ellipse|polygon|polyline|line|text|use)\b/gi) || []).length;
  useEffect(() => {
    const t = setTimeout(() => {
      const svg = closePartialSvg(code);
      if (!svg) return;
      try {
        const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
        if (doc.querySelector("parsererror")) return; // halbfertig – letztes gutes Bild behalten
      } catch { return; }
      setUrl("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
    }, 120);
    return () => clearTimeout(t);
  }, [code]);
  return (
    <div className="not-prose my-2 overflow-hidden rounded-xl border border-white/10 bg-[#0b0b0f]">
      <div className="relative flex min-h-[220px] items-center justify-center">
        {url ? <img src={url} alt="Grafik entsteht" className="mx-auto max-h-[70vh] w-full object-contain transition-opacity duration-300" />
          : <div className="text-sm text-muted-foreground">Leinwand wird vorbereitet …</div>}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_35%,rgba(255,255,255,.06)_50%,transparent_65%)] bg-[length:250%_100%] animate-[mfx-sheen_1.6s_linear_infinite]" />
      </div>
      <div className="flex items-center gap-2 border-t border-white/5 px-3 py-2 text-[12px] text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>🎨 Zeichnet … {shapes} {shapes === 1 ? "Form" : "Formen"}</span>
        <div className="ml-auto h-1 w-24 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-sky-400 transition-all duration-500" style={{ width: Math.min(95, 8 + shapes * 1.6) + "%" }} />
        </div>
      </div>
    </div>
  );
}

function CodeCard({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const ext = EXT[lang] || "txt";
  const isHtml = lang === "html" || /^\s*<(!doctype|html)/i.test(code);
  const looksSvg = (lang === "svg" || lang === "xml" || !lang) && /^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(code);
  const isSvg = looksSvg && /<\/svg>\s*$/i.test(code.trim());
  const drawing = looksSvg && !isSvg;
  const [showCode, setShowCode] = useState(false);
  const svgUrl = useMemo(() => isSvg ? "data:image/svg+xml;charset=utf-8," + encodeURIComponent(code.replace(/<script[\s\S]*?<\/script>/gi, "")) : "", [isSvg, code]);
  if (drawing) return <SvgDrawing code={code} />;

  const copy = async () => {
    if (!(await copyText(code))) { toast.error("Kopieren hat nicht geklappt. Halte den Code gedrückt und kopiere ihn von Hand."); return; }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  // Im eingebetteten Mythos-Browser öffnen statt in einem neuen Tab.
  const run = () => openInMythosBrowser({ html: code, title: (code.match(/<title>([^<]{1,60})<\/title>/i)?.[1] || "App").trim() });

  return (
    <div className="not-prose group/code relative my-3 overflow-hidden rounded-xl border border-white/10 bg-background/50">
      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-1.5">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{lang || "code"}</span>
        <div className="ml-auto flex items-center gap-1">
          {isHtml && (
            <IconBtn onClick={run} title="HTML ausführen"><Play className="h-3.5 w-3.5" /></IconBtn>
          )}
          <IconBtn onClick={() => download(/^(?:\/\/|#|<!--)\s*([\w.-]+\.[a-zA-Z0-9]{1,12})/.exec(code.trim())?.[1] || `mythos-code.${ext}`, code)} title="Als Datei herunterladen">
            <Download className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn onClick={copy} title="Kopieren">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </IconBtn>
        </div>
      </div>
      {isSvg && (
        <button type="button" onClick={() => openInMythosBrowser({ html: `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#0b0b0f">${code.replace(/<script[\s\S]*?<\/script>/gi, "")}<style>svg{max-width:100vw;max-height:100vh;width:100%;height:auto}</style>`, title: "Grafik" })} className="block w-full bg-[#0b0b0f]" title="Groß ansehen">
          <img src={svgUrl} alt="Grafik" className="mx-auto max-h-[70vh] w-full object-contain" />
        </button>
      )}
      {isSvg && (
        <button type="button" onClick={() => setShowCode(!showCode)} className="w-full border-t border-white/5 px-3 py-1.5 text-left text-[11px] text-muted-foreground hover:text-foreground">
          {showCode ? "Code ausblenden" : "SVG-Code anzeigen"}
        </button>
      )}
      {(!isSvg || showCode) && <pre className="overflow-x-auto p-3 text-[13px] leading-relaxed"><code>{code}</code></pre>}
    </div>
  );
}

export default function MarkdownMessage({ content }: { content: string }) {
  const split = useMemo(() => splitFiles(content), [content]);
  const [viewing, setViewing] = useState<ViewFile | null>(null);
  const blocks = useMemo(() => extractBlocks(content), [content]);
  // Hat Mythos echte Dateien geschickt, kommen nur die ins ZIP; sonst alle Codeblöcke + die Antwort.
  const hasFiles = blocks.some(b => b.isFile);
  const zipFiles = hasFiles ? blocks.filter(b => b.isFile) : blocks;

  const zipAll = async () => {
    const zip = new JSZip();
    zipFiles.forEach((b, i) => {
      const name = b.name.includes(".") ? b.name : `datei-${i + 1}.txt`;
      if (b.base64) { try { zip.file(name, b.code.replace(/^data:[^,]*,/, "").replace(/\s+/g, ""), { base64: true }); } catch { /* kaputt, weglassen */ } }
      else if (extOf(name) === "bbmodel") { const r = finishBBModel(b.code); if (r.ok === true) zip.file(name, r.content); }
      else zip.file(name, b.code);
    });
    if (!hasFiles) zip.file("antwort.md", content);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "mythos-dateien.zip";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast.success("ZIP heruntergeladen");
  };

  return (
    <>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children, ...props }: any) => {
            const raw = String(children ?? "");
            const info = /language-(\S+)/.exec(className || "")?.[1] || "";
            const file = parseFileInfo(info);
            if (file) return <CodeCard lang={extOf(file.name)} code={raw.replace(/\n$/, "")} />;
            if (/^mythos-ui$/i.test(info)) return <SmartUI raw={raw} />;
            const lang = /^[\w+#-]+/.exec(info)?.[0] || "";
            const isBlock = lang || raw.includes("\n");
            if (!isBlock) {
              return <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[13px]" {...props}>{children}</code>;
            }
            return <CodeCard lang={lang} code={raw.replace(/\n$/, "")} />;
          },
        }}
      >
        {split.text}
      </ReactMarkdown>

      {(split.files.length > 0 || split.writing) && (
        <div className="not-prose mt-3 grid gap-2">
          {split.files.map((f, i) => <FileCard key={i + f.name} name={f.name} content={f.content} base64={f.base64} onOpen={setViewing} />)}
          {split.writing && <WritingCard name={split.writing.name} lines={split.writing.lines} />}
        </div>
      )}
      <FileViewer file={viewing} onClose={() => setViewing(null)} />

      {zipFiles.length > 1 && (
        <div className="not-prose mt-2">
          <button
            type="button"
            onClick={zipAll}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground hover:bg-white/10"
          >
            <FileArchive className="h-3.5 w-3.5" /> Alle {zipFiles.length} Dateien als ZIP
          </button>
        </div>
      )}
    </>
  );
}
