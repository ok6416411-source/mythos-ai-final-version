// Eine Stelle für die Adresse der Website. App und CLI fragen sie beim Anmelden ab,
// damit nach einem Domainwechsel keine alte Adresse mehr in installierten Versionen steckt.
export const SITE_URL = (Deno.env.get("MYTHOS_SITE_URL") || "https://mythos-ai-final-versionolo.lovable.app").replace(/\/$/, "");
