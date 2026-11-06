import { describe, expect, it } from "vitest";
import { buildBBModel, finishBBModel } from "./bbmodel";

describe("bbmodel", () => {
  const spec = { name: "Test Hut", cubes: [
    { name: "krempe", from: [1, 0, 1], to: [15, 1, 15], color: "#d8b45a" },
    { name: "band", from: [4, 1, 4], to: [12, 2, 12], c: "#7a2e1d", r: [0, 45, 0], group: "oben" },
  ] };
  it("baut eine vollständige Datei", () => {
    const m = buildBBModel(spec) as any;
    expect(m.meta.format_version).toBe("4.5");
    expect(m.elements).toHaveLength(2);
    expect(Object.keys(m.elements[0].faces)).toEqual(["north", "east", "south", "west", "up", "down"]);
    expect(m.elements[0].faces.up.texture).toBe(m.textures[0].uuid);
    expect(m.textures[0].source.startsWith("data:image/png;base64,iVBORw0KGgo")).toBe(true);
    expect(m.outliner).toHaveLength(2);
    expect(m.elements[1].rotation).toEqual([0, 45, 0]);
  });
  it("erkennt leere und kaputte Modelle", () => {
    expect(finishBBModel('{"cubes":[]}').ok).toBe(false);
    expect(finishBBModel('{"name":"x","cubes":[{"from":[0,0').ok).toBe(false);
    expect(finishBBModel(JSON.stringify(spec)).ok).toBe(true);
  });
});
