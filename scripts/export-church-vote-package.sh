#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${1:-/tmp/church-vote-package}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

FILES=(
  "api/church-vote.js"
  "api/public/church-vote-admin.html"
  "api/public/church-vote-voter.html"
  "services/church-vote-state.js"
  "docs/church-online-voting-system-design.md"
  "docs/church-vote-migration-to-codex.md"
  "docs/church-voting-openapi.yaml"
  "docs/church-voting-schema.sql"
  "docs/church-voting-ui-checklist.md"
  "scripts/move-church-vote-to-codex.sh"
)

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR/files"

cd "$ROOT"
for f in "${FILES[@]}"; do
  mkdir -p "$OUT_DIR/files/$(dirname "$f")"
  cp "$f" "$OUT_DIR/files/$f"
  echo "copied $f"
done

cat > "$OUT_DIR/APPLY_STEPS.md" <<'NOTE'
# Apply church-vote package into Codex repo

1. Copy `files/*` into your target repo root (overwrite if needed).
2. Manually merge these two files in target repo:
   - `api/index.js` -> mount `/church-vote` static + router
   - `config/index.js` -> add `CHURCH_VOTE_*` env keys
3. Commit:
   ```bash
   git add .
   git commit -m "feat: add church-vote module"
   ```
NOTE

tar -C "$OUT_DIR" -czf "$OUT_DIR.tar.gz" .

echo "Package directory: $OUT_DIR"
echo "Tarball: $OUT_DIR.tar.gz"
