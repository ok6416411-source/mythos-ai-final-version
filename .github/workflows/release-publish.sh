#!/usr/bin/env bash
# Lädt Dateien in das Release $TAG hoch (legt es bei Bedarf an) und merkt sich Version + Quelle.
# Eingabe (env): TAG, TITLE, VER, HASH, GITHUB_REPOSITORY, optional PRUNE (Muster alter Dateien, z. B. 'MythosCode-Setup-*')
# Argumente: Dateien – in dieser Reihenfolge hochgeladen (Update-Feed latest.yml also zuletzt angeben).
set -euo pipefail
REPO="${RELEASE_REPO:-$GITHUB_REPOSITORY}"
if [ "$REPO" != "${GITHUB_REPOSITORY:-}" ] && [ "${HAS_RELEASE_TOKEN:-true}" != "true" ]; then
  echo "::error::Secret RELEASE_TOKEN fehlt – ohne ihn darf GitHub nicht in $REPO hochladen. Settings > Secrets and variables > Actions > New repository secret."
  exit 1
fi
NOTES="Automatisch gebaut. Download über https://mythos-ai-final-version.lovable.app/downloads

<!-- version: $VER -->
<!-- source: $HASH -->"
gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1 || \
  gh release create "$TAG" --repo "$REPO" --title "$TITLE" --notes "$NOTES" --latest=false
for FILE in "$@"; do
  gh release upload "$TAG" "$FILE" --repo "$REPO" --clobber
done
# Alte versionierte Dateien entfernen, damit im Release nur die aktuelle Version liegt.
if [ -n "${PRUNE:-}" ]; then
  KEEP=$(for f in "$@"; do basename "$f"; done)
  gh release view "$TAG" --repo "$REPO" --json assets -q '.assets[].name' | while read -r NAME; do
    case "$NAME" in
      $PRUNE) printf '%s\n' "$KEEP" | grep -qxF "$NAME" || gh release delete-asset "$TAG" "$NAME" --repo "$REPO" --yes ;;
    esac
  done
fi
gh release edit "$TAG" --repo "$REPO" --title "$TITLE" --notes "$NOTES"
