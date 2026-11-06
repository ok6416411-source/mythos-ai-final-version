import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ListChecks, X } from "lucide-react";
import { itemKey, mergedItems, readUserChecks, writeUserChecks, type PinnedChecklist as List } from "@/lib/pinnedChecklist";

/** Checkliste, unten über dem Eingabefeld angeheftet. Aktualisiert sich, sobald Mythos eine neue Version schickt. */
export default function PinnedChecklist({ list, convId }: { list: List; convId: string | null }) {
  const store = convId || "neu";
  const [user, setUser] = useState(() => readUserChecks(store, list.id));
  const [open, setOpen] = useState(true);
  const [hidden, setHidden] = useState(false);
  const sig = JSON.stringify(list);
  // Neue Version von Mythos: wieder zeigen und gespeicherte Häkchen neu einlesen.
  useEffect(() => { setUser(readUserChecks(store, list.id)); setHidden(false); }, [sig, store, list.id]);
  const items = useMemo(() => mergedItems(list, user), [list, user]);
  const done = items.filter(i => i.done).length;
  const all = done === items.length;
  // Fertige Listen klappen sich zusammen.
  useEffect(() => { if (all) setOpen(false); }, [all]);
  if (hidden) return null;

  const toggle = (text: string, now: boolean) => {
    const next = { ...user, [itemKey(text)]: !now };
    setUser(next);
    writeUserChecks(store, list.id, next);
  };

  return (
    <div className="mb-2 overflow-hidden rounded-2xl border border-border bg-card/80 backdrop-blur-md">
      <div className="flex items-center gap-2.5 px-3.5 py-2.5">
        <ListChecks className={`h-4 w-4 shrink-0 ${all ? "text-emerald-500" : "text-muted-foreground"}`} />
        <button type="button" onClick={() => setOpen(o => !o)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="truncate text-[13.5px] font-medium">{list.title}</span>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{done}/{items.length}</span>
          <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
        </button>
        <button type="button" onClick={() => setHidden(true)} title="Ausblenden" aria-label="Checkliste ausblenden" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="h-[2px] bg-muted">
        <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${(done / items.length) * 100}%` }} />
      </div>
      {open && (
        <ul className="max-h-48 overflow-y-auto px-2 py-1.5">
          {items.map((it, i) => (
            <li key={i}>
              <button type="button" onClick={() => toggle(it.text, it.done)} className="flex w-full items-start gap-2.5 rounded-lg px-1.5 py-1.5 text-left text-[13px] hover:bg-muted/60">
                <span className={`mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors ${it.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/50"}`}>
                  {it.done && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className={it.done ? "text-muted-foreground line-through" : ""}>{it.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
