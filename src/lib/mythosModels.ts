// Mythos model catalog for the website — generated from the shared catalog
// (supabase/functions/_shared/modelCatalog.ts), the single source of truth.
import {
  EFFORTS, MODEL_FAMILIES, DEFAULT_MODEL_ID, familyLabel,
  type EffortId, type Tier, type ModelFamily,
} from "../../supabase/functions/_shared/modelCatalog";

export type { Tier, EffortId };

export type MythosEffort = { id: EffortId; label: string; minTier: Tier; hint: string };
export type MythosTheme = ModelFamily["theme"];
export type MythosFamily = {
  id: string;
  name: string;
  version: string;
  label: string;
  minTier: Tier;
  rank: number;
  kind: "chat" | "code";
  desc: string;
  theme: MythosTheme;
  efforts: MythosEffort[];
};

export const MYTHOS_FAMILIES: MythosFamily[] = MODEL_FAMILIES.map((f) => ({
  id: f.id, name: f.name, version: f.version, label: familyLabel(f), minTier: f.minTier,
  rank: f.rank, kind: f.kind, desc: f.desc, theme: f.theme,
  efforts: f.efforts.map((e) => ({ id: e.id, label: EFFORTS[e.id].label, minTier: e.minTier, hint: EFFORTS[e.id].hint })),
}));

export const DEFAULT_MYTHOS_ID = DEFAULT_MODEL_ID;

const RANK: Record<Tier, number> = { free: 0, light: 1, pro: 2 };
export const tierAllows = (tier: Tier, min: Tier) => RANK[tier] >= RANK[min];

export function parseMythosId(id: string): { family: MythosFamily; effort: MythosEffort } | null {
  const [f, e] = (id || "").split(":");
  const family = MYTHOS_FAMILIES.find(x => x.id === f);
  if (!family) return null;
  const effort = family.efforts.find(x => x.id === e);
  if (!effort) return null;
  return { family, effort };
}

export function mythosLabel(id: string): string {
  const p = parseMythosId(id) ?? parseMythosId(DEFAULT_MYTHOS_ID)!;
  return `${p.family.label} · ${p.effort.label}`;
}

export function mythosTheme(id: string): MythosTheme {
  return (parseMythosId(id) ?? parseMythosId(DEFAULT_MYTHOS_ID)!).family.theme;
}

export function isAllowed(id: string, tier: Tier): boolean {
  const p = parseMythosId(id);
  if (!p) return false;
  return tierAllows(tier, p.family.minTier) && tierAllows(tier, p.effort.minTier);
}
