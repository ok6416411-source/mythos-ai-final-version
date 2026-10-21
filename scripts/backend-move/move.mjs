// Kopiert alles aus Lovable Cloud ins eigene Supabase-Projekt (läuft im Workflow "Backend umziehen").
// Liest über die Funktion backend-export (nur Admin) und schreibt direkt in die neue Datenbank.
// Kann beliebig oft laufen: Vorhandenes bleibt, nur Fehlendes kommt dazu.
//
// Umgebung: OLD_URL, OLD_ANON, OLD_ADMIN_EMAIL, OLD_ADMIN_PASSWORD, NEW_DB_URL, NEW_URL, NEW_SERVICE_KEY
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const env = (k) => { const v = process.env[k]; if (!v) throw new Error(`${k} fehlt`); return v; };
const OLD_URL = env("OLD_URL"), OLD_ANON = env("OLD_ANON");
const log = (...a) => console.log(...a);

// --- Bei Lovable Cloud als Admin anmelden ---
const login = await fetch(`${OLD_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: OLD_ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: env("OLD_ADMIN_EMAIL"), password: env("OLD_ADMIN_PASSWORD") }),
});
if (!login.ok) throw new Error(`Anmeldung bei Lovable Cloud fehlgeschlagen (${login.status}): ${await login.text()}`);
const { access_token } = await login.json();

async function exp(body) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`${OLD_URL}/functions/v1/backend-export`, {
      method: "POST",
      headers: { apikey: OLD_ANON, Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) return r.json();
    const t = await r.text();
    if (r.status === 404) throw new Error("Funktion backend-export ist bei Lovable noch nicht bereitgestellt.");
    if (r.status < 500 || i === 3) throw new Error(`backend-export ${body.action}: ${r.status} ${t.slice(0, 300)}`);
    await new Promise((res) => setTimeout(res, 2000 * (i + 1)));
  }
}

const info = await exp({ action: "info" });
log(`Modus: ${info.mode === "sql" ? "Datenbank (mit Passwörtern)" : "API (ohne Passwort-Hashes)"}`);

const db = new pg.Client({ connectionString: env("NEW_DB_URL"), ssl: process.env.NEW_DB_SSL === "off" ? false : { rejectUnauthorized: false } });
await db.connect();
// Keine Trigger/Fremdschlüssel-Prüfung beim Kopieren (sonst z. B. doppelte Profile durch handle_new_user).
await db.query("set session_replication_role = replica").catch((e) => log("Hinweis: replica-Modus nicht erlaubt:", e.message));

const target = new Map();
for (const r of (await db.query(`
  select table_schema, table_name, column_name, data_type from information_schema.columns
  where table_schema in ('public','auth') and is_generated = 'NEVER'`)).rows) {
  const k = `${r.table_schema}.${r.table_name}`;
  if (!target.has(k)) target.set(k, new Map());
  target.get(k).set(r.column_name, r.data_type);
}

// API-Modus: Nutzer kommen von der Admin-API und müssen auf auth.users abgebildet werden.
const apiUser = (u) => ({
  instance_id: "00000000-0000-0000-0000-000000000000", id: u.id, aud: u.aud || "authenticated", role: u.role || "authenticated",
  email: u.email, encrypted_password: "", email_confirmed_at: u.email_confirmed_at, created_at: u.created_at, updated_at: u.updated_at,
  last_sign_in_at: u.last_sign_in_at, raw_app_meta_data: u.app_metadata, raw_user_meta_data: u.user_metadata, phone: u.phone || null,
  is_anonymous: u.is_anonymous ?? false,
});

const sources = info.mode === "sql"
  ? info.tables
  : [{ schema: "auth", table: "users", rows: Infinity }, ...[...target.keys()].filter((k) => k.startsWith("public.")).map((k) => ({ schema: "public", table: k.slice(7), rows: Infinity }))];

const report = [];
for (const t of sources) {
  const key = `${t.schema}.${t.table}`, cols = target.get(key);
  if (!cols) { report.push(`FEHLT im neuen Projekt: ${key} (${t.rows} Zeilen)`); continue; }
  let copied = 0, read = 0;
  for (let offset = 0; offset < t.rows; offset += 500) {
    let rows;
    try { ({ rows } = await exp({ action: "rows", schema: t.schema, table: t.table, offset, limit: 500 })); }
    catch (e) { if (info.mode !== "sql") break; throw e; } // API-Modus: Tabelle gibt es alt nicht
    if (info.mode !== "sql" && t.schema === "auth") rows = rows.map(apiUser);
    if (!rows.length) break;
    read += rows.length;
    const use = [...cols.keys()].filter((c) => c in rows[0]);
    const list = use.map((c) => `"${c}"`).join(",");
    const res = await db.query(
      `insert into "${t.schema}"."${t.table}" (${list}) overriding system value
       select ${list} from json_populate_recordset(null::"${t.schema}"."${t.table}", $1::json) on conflict do nothing`,
      [JSON.stringify(rows)]);
    copied += res.rowCount;
    if (rows.length < 500) break;
  }
  report.push(`${key}: ${read} gelesen, ${copied} neu`);
}

// Zähler (serial/identity) hinter die höchste vorhandene ID setzen.
for (const s of (await db.query(`
  select table_name, column_name, pg_get_serial_sequence(format('public.%I', table_name), column_name) as seq
  from information_schema.columns where table_schema = 'public'
  and pg_get_serial_sequence(format('public.%I', table_name), column_name) is not null`)).rows) {
  await db.query(`select setval($1, greatest(coalesce((select max("${s.column_name}") from public."${s.table_name}"), 0), 1))`, [s.seq]);
}
await db.end();

// --- Dateien (Storage) ---
const neu = createClient(env("NEW_URL"), env("NEW_SERVICE_KEY"), { auth: { persistSession: false } });
for (const b of info.buckets) {
  await neu.storage.createBucket(b.id, { public: b.public, fileSizeLimit: b.file_size_limit ?? undefined, allowedMimeTypes: b.allowed_mime_types ?? undefined }).catch(() => {});
  const { files } = await exp({ action: "files", bucket: b.id });
  let ok = 0, skip = 0, fail = 0;
  for (const f of files) {
    if (!f.url) { fail++; continue; }
    const r = await fetch(f.url).catch(() => null);
    if (!r?.ok) { fail++; continue; }
    const { error } = await neu.storage.from(b.id).upload(f.path, Buffer.from(await r.arrayBuffer()), {
      contentType: r.headers.get("content-type") || undefined, upsert: false,
    });
    if (!error) ok++; else if (/exists|Duplicate/i.test(error.message)) skip++; else fail++;
  }
  report.push(`Dateien ${b.id}: ${ok} kopiert, ${skip} schon da, ${fail} Fehler (von ${files.length})`);
}

log("\n=== Ergebnis ===\n" + report.join("\n"));
