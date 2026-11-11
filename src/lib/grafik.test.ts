import { describe, expect, it } from "vitest";
import { grafikPrompt, grafikRequest } from "./grafik";

describe("grafik", () => {
  it("erkennt /grafik und Zeichen-Wünsche", () => {
    expect(grafikRequest("/grafik ein Drache über einer Burg", false)).toBe("ein Drache über einer Burg");
    expect(grafikRequest("Zeichne einen epischen Drachen über den Bergen", false)).toBeTruthy();
    expect(grafikRequest("mach mir ein Logo für mein Café", false)).toBeTruthy();
  });
  it("lässt Apps, Code und 3D in Ruhe", () => {
    expect(grafikRequest("Bau mir eine Website für mein Café", false)).toBeNull();
    expect(grafikRequest("Bau mir eine detaillierte 3D-Szene: ein drehender Apfel", false)).toBeNull();
    expect(grafikRequest("Wie spät ist es?", false)).toBeNull();
    expect(grafikRequest("Zeichne das", true)).toBeNull();
  });
  it("Auftrag enthält SVG (kein Bildgenerator auf alten Servern)", () => {
    expect(grafikPrompt("Drache")).toMatch(/SVG/);
  });
});
