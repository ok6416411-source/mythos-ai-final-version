import type { CSSProperties } from "react";
import { Switch } from "@/components/ui/switch";
import { MYTHOS_FAMILIES } from "@/lib/mythosModels";
import { playModelSelect, setFxEnabled, setFxModel, useModelFx } from "@/lib/modelFx";

/** Einstellungen → Design: Modell-Animationseffekte (kontoweit für Web, App und CLI). */
export default function DesignSettings() {
  const fx = useModelFx();
  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <h2 className="font-display font-semibold">Modell-Animationseffekte</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Website, Mythos Code und die CLI passen ihr Design live an das gewählte Modell an – auf allen Geräten, auf denen du mit diesem Konto angemeldet bist.
          </p>
        </div>
        <Switch checked={fx.on} onCheckedChange={(v) => { setFxEnabled(v); if (!fx.model) setFxModel("v1:normal"); }} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {MYTHOS_FAMILIES.map((f) => {
          const active = fx.model.split(":")[0] === f.id;
          return (
            <button
              key={f.id}
              data-fx={f.theme.fx}
              style={{ "--ia": f.theme.a, "--ib": f.theme.b } as CSSProperties}
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); playModelSelect(f.theme, { x: r.left + r.width / 2, y: r.top + r.height / 2 }); setFxModel(`${f.id}:${f.efforts.find((x) => x.id === "normal")?.id ?? f.efforts[0].id}`); }}
              className={`mfx-item flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm ${active ? "border-white/30 bg-white/5" : "border-white/10"}`}
            >
              <span className="mfx-gem !mt-0" />
              <span className="truncate">{f.name} {f.version}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Vorschau: Klick auf ein Modell. Das Design folgt immer dem zuletzt gewählten Modell – egal ob du es hier, in der App oder in der CLI wählst.</p>
    </div>
  );
}
