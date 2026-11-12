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

import { renameLegacyModels } from "./mythosModels";
describe("alte Modellnamen", () => {
  it("werden ersetzt, Mythos Code (App) bleibt", () => {
    expect(renameLegacyModels("Ich bin Mythos v2.")).toBe("Ich bin Mythos Amber 2.");
    expect(renameLegacyModels("MythosCode v1.5 und Mythos v1")).toBe("Mythos Atlas 1.6 und Mythos Spark 1");
    expect(renameLegacyModels("Lade Mythos Code herunter")).toBe("Lade Mythos Code herunter");
  });
});

import { closePartialSvg } from "./grafik";
describe("Grafik live zeichnen", () => {
  it("schließt halbfertiges SVG gültig", () => {
    const part = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="a"><stop offset="0"/></linearGradient></defs><g><rect width="10" height="10"/><circle cx="5" cy="5" r="3"/><path d="M0 0 L10';
    const out = closePartialSvg(part)!;
    expect(out.endsWith("</g></svg>")).toBe(true);
    expect(new DOMParser().parseFromString(out, "image/svg+xml").querySelector("parsererror")).toBeNull();
  });
  it("Auftrag startet mit /grafik (keine Websuche)", () => {
    expect(grafikPrompt("Drache").startsWith("/grafik")).toBe(true);
  });
});
