import { describe, expect, it } from "vitest";
import { draftDeckPrompt, draftTheme, draftThemesReply, isDraftStart } from "./draft";

describe("20-€-Draft Start", () => {
  it("erkennt die üblichen Formulierungen", () => {
    for (const t of ["Lass uns das 20€ Spiel spielen", "20 euro spiel", "Kennst du das 20-€-Spiel?", "spielen wir 20 dollar draft", "20$ game"]) expect(isDraftStart(t)).toBe(true);
    for (const t of ["Was kostet ein Spiel für 20 €?", "Starte das 20-€-Draft mit dem Thema „Burger“."]) expect(isDraftStart(t)).toBe(false);
  });
  it("Themenwahl enthält 3 Themen als Baustein", () => {
    const j = JSON.parse(draftThemesReply().split("```mythos-ui\n")[1].split("\n```")[0]);
    expect(j.type).toBe("draft"); expect(j.themes).toHaveLength(3);
  });
  it("Thema wird erkannt und genau beauftragt", () => {
    expect(draftTheme("Starte das 20-€-Draft mit dem Thema „Bester Burger“.")).toBe("Bester Burger");
    expect(draftDeckPrompt("Bester Burger")).toMatch(/Genau 14 Karten/);
  });
});
