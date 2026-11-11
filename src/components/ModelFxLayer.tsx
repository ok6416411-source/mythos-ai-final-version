import { useEffect } from "react";
import "@/lib/mythos-code-shared/fxengine.js";
import { useFxSync, useModelFx } from "@/lib/modelFx";
import { mythosTheme, parseMythosId } from "@/lib/mythosModels";

type FxApi = { start: (t: object) => void; stop: () => void; burst: (x: number, y: number, s?: number) => void };
const engine = () => (window as unknown as { MythosFx?: FxApi }).MythosFx;

/** Live-Design im Modell-Look: Partikel-Engine (Flammen, Funken, Blitze, Orbit, Wellen)
 *  am Bildschirmrand und an Buttons beim Hovern, dazu Aurora-Leiste und leuchtende Ränder. */
export default function ModelFxLayer() {
  useFxSync();
  const fx = useModelFx();
  const on = fx.on && !!parseMythosId(fx.model);
  const theme = on ? mythosTheme(fx.model) : null;
  useEffect(() => {
    if (theme) engine()?.start(theme); else engine()?.stop();
  }, [theme?.fx, theme?.a]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => engine()?.stop(), []);
  if (!theme) return null;
  return (
    <div className={`mfx-layer mfx-${theme.fx}`} aria-hidden key={fx.model}>
      <div className="mfx-aurora" />
      <div className="mfx-edge" />
      {theme.fx === "orbit" && <div className="mfx-ring" />}
    </div>
  );
}
