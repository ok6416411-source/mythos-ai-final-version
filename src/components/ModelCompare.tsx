import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { MYTHOS_FAMILIES } from "@/lib/mythosModels";

const ROWS: [keyof (typeof MYTHOS_FAMILIES)[number]["scores"], string][] = [
  ["speed", "Tempo"], ["smart", "Denken"], ["code", "Coding"], ["creative", "Kreativ"],
];
const PLAN = { free: "Kostenlos", light: "Light", pro: "Pro" } as const;

/** Alle Mythos-Modelle nebeneinander: Stärken, Tempo, Plan, Aufwände, Neuerungen. */
export default function ModelCompare({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogTitle>Modelle vergleichen</DialogTitle>
        <DialogDescription>Von klein und schnell bis groß und gründlich.</DialogDescription>
        <div className="grid gap-3 sm:grid-cols-2">
          {MYTHOS_FAMILIES.map((f) => (
            <div key={f.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-[4px]" style={{ background: `linear-gradient(135deg, ${f.theme.a}, ${f.theme.b})` }} />
                <span className="font-medium">{f.label}</span>
                <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-muted-foreground">{PLAN[f.minTier]}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{f.desc}. Ideal für: {f.strengths}.</p>
              <div className="mt-2 space-y-1">
                {ROWS.map(([k, label]) => (
                  <div key={k} className="flex items-center gap-2 text-[11px]">
                    <span className="w-14 text-muted-foreground">{label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${f.scores[k] * 20}%`, background: `linear-gradient(90deg, ${f.theme.a}, ${f.theme.b})` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Aufwände: {f.efforts.map((e) => e.label).join(", ")}</p>
              {f.changelog.length > 0 && <p className="mt-1 text-[11px] text-muted-foreground">Neu in {f.version}: {f.changelog[f.changelog.length - 1].text}</p>}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
