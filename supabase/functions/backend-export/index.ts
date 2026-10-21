// Umzug weg von Lovable Cloud: liefert alle Daten (Tabellen, Nutzer samt Passwort-Hash, Dateien)
// an den GitHub-Workflow "Backend umziehen", der sie ins eigene Supabase-Projekt kopiert.
// Server-Secrets (API-Schlüssel) gibt sie bewusst nicht heraus – die trägt man im neuen Projekt selbst ein.
// Nur für Admins (has_role admin). Ändert nichts an den Daten, liest nur.
// POST { action: "info" | "rows" | "files", schema?, table?, offset?, limit?, bucket? }
import { createClient } from "npm:@supabase/supabase-js@2.103.3";
import postgres from "npm:postgres@3.4.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const URL_ = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const DB_URL = Deno.env.get("SUPABASE_DB_URL");
const sql = DB_URL ? postgres(DB_URL, { max: 1, prepare: false }) : null;

const AUTH_TABLES = ["users", "identities"];
const NAME_RE = /^[a-z_][a-z0-9_]{0,62}$/;

async function tables(): Promise<{ schema: string; table: string; rows: number }[]> {
  if (!sql) return [];
  const list = await sql`
    select table_schema as schema, table_name as table from information_schema.tables
    where table_type = 'BASE TABLE' and (table_schema = 'public' or (table_schema = 'auth' and table_name = any(${AUTH_TABLES})))
    order by table_schema desc, table_name`;
  const out = [];
  for (const t of list) {
    const [{ n }] = await sql.unsafe(`select count(*)::int as n from "${t.schema}"."${t.table}"`);
    out.push({ schema: t.schema, table: t.table, rows: n });
  }
  return out;
}

async function listFiles(bucket: string, prefix = "", out: string[] = []): Promise<string[]> {
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(error.message);
    for (const f of data ?? []) {
      const p = prefix ? `${prefix}/${f.name}` : f.name;
      if (f.id === null) await listFiles(bucket, p, out); else out.push(p);
    }
    if (!data || data.length < 1000) return out;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: claims } = await admin.auth.getClaims(token).catch(() => ({ data: null }));
  const uid = claims?.claims?.sub;
  if (!uid) return json({ error: "Unauthorized" }, 401);
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: uid, _role: "admin" });
  if (!isAdmin) return json({ error: "Nur für Admins." }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  try {
    if (body.action === "info") {
      const { data: buckets } = await admin.storage.listBuckets();
      return json({ mode: sql ? "sql" : "api", tables: await tables(), buckets: buckets ?? [] });
    }

    if (body.action === "rows") {
      const schema = String(body.schema || "public"), table = String(body.table || "");
      const offset = Math.max(0, Number(body.offset) || 0), limit = Math.min(2000, Math.max(1, Number(body.limit) || 500));
      if (!NAME_RE.test(schema) || !NAME_RE.test(table)) return json({ error: "bad name" }, 400);
      if (schema !== "public" && !(schema === "auth" && AUTH_TABLES.includes(table))) return json({ error: "not allowed" }, 400);
      if (sql) {
        const [{ rows }] = await sql.unsafe(
          `select coalesce(json_agg(t), '[]'::json) as rows from (select * from "${schema}"."${table}" order by ctid offset ${offset} limit ${limit}) t`);
        return json({ rows });
      }
      // Ohne Datenbank-Zugang: öffentliche Tabellen über die API, Nutzer ohne Passwort-Hash.
      if (schema === "auth") {
        if (table !== "users") return json({ rows: [] });
        const page = Math.floor(offset / limit) + 1;
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: limit });
        if (error) throw new Error(error.message);
        return json({ rows: data.users });
      }
      const { data, error } = await admin.from(table).select("*").range(offset, offset + limit - 1);
      if (error) throw new Error(error.message);
      return json({ rows: data ?? [] });
    }

    if (body.action === "files") {
      const bucket = String(body.bucket || "");
      const paths = await listFiles(bucket);
      const files: { path: string; url: string | null }[] = [];
      for (let i = 0; i < paths.length; i += 100) {
        const { data } = await admin.storage.from(bucket).createSignedUrls(paths.slice(i, i + 100), 3600);
        for (const d of data ?? []) files.push({ path: d.path ?? "", url: d.signedUrl ?? null });
      }
      return json({ files });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
