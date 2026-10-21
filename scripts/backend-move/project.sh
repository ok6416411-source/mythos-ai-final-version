#!/usr/bin/env bash
# Holt Adresse, Schlüssel und Datenbank-Verbindung des eigenen Supabase-Projekts über die Management-API
# und schreibt sie (maskiert) nach $GITHUB_ENV.
# Eingabe (env): SUPABASE_ACCESS_TOKEN, REF, DB_PASSWORD
set -euo pipefail
api() { curl -fsS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" "https://api.supabase.com/v1/projects/$REF$1"; }

KEYS=$(api "/api-keys?reveal=true")
ANON=$(jq -r '[.[] | select(.name == "anon")][0].api_key // empty' <<<"$KEYS")
[ -n "$ANON" ] || ANON=$(jq -r '[.[] | select(.type == "publishable")][0].api_key // empty' <<<"$KEYS")
SERVICE=$(jq -r '[.[] | select(.name == "service_role")][0].api_key // empty' <<<"$KEYS")
[ -n "$SERVICE" ] || SERVICE=$(jq -r '[.[] | select(.type == "secret")][0].api_key // empty' <<<"$KEYS")
[ -n "$ANON" ] && [ -n "$SERVICE" ] || { echo "Keine API-Schlüssel gefunden – stimmt SUPABASE_PROJECT_REF?"; exit 1; }

# GitHub-Runner haben kein IPv6, deshalb über den Pooler (Session-Modus, Port 5432).
POOL=$(api "/config/database/pooler" | jq -c '[.[] | select(.database_type == "PRIMARY")][0] // .[0]')
DB_HOST=$(jq -r .db_host <<<"$POOL"); DB_USER=$(jq -r .db_user <<<"$POOL")
PW=$(jq -rn --arg p "$DB_PASSWORD" '$p|@uri')
DB_URL="postgresql://$DB_USER:$PW@$DB_HOST:5432/postgres"

echo "::add-mask::$SERVICE"; echo "::add-mask::$PW"; echo "::add-mask::$DB_PASSWORD"
{
  echo "NEW_URL=https://$REF.supabase.co"
  echo "NEW_ANON=$ANON"
  echo "NEW_SERVICE_KEY=$SERVICE"
  echo "NEW_DB_URL=$DB_URL"
} >> "$GITHUB_ENV"
echo "Projekt $REF gefunden (Datenbank über $DB_HOST)."
