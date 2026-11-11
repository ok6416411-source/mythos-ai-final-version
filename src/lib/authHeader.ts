import { supabase } from "@/integrations/supabase/client";

/** Authorization-Header für Edge Functions: das Login-Token des Nutzers (die Funktionen verlangen eine Anmeldung).
 *  Ist es fast abgelaufen, wird es vorher erneuert. Ohne Anmeldung der öffentliche Schlüssel (für Gast-Funktionen). */
export async function authHeader(): Promise<Record<string, string>> {
  let token: string | undefined;
  try {
    let { data: { session } } = await supabase.auth.getSession();
    if (session && (session.expires_at ?? 0) * 1000 < Date.now() + 30_000) {
      const r = await supabase.auth.refreshSession();
      session = r.data.session ?? session;
    }
    token = session?.access_token;
  } catch { /* unten: öffentlicher Schlüssel */ }
  return { Authorization: `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` };
}
