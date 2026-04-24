#!/usr/bin/env bash
set -euo pipefail

TARGET_REPO_URL="${1:-https://github.com/Roy5168/Codex.git}"
TARGET_DIR="${2:-/tmp/Codex}"
SOURCE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

FILES=(
  "api/church-vote.js"
  "api/public/church-vote-admin.html"
  "api/public/church-vote-voter.html"
  "services/church-vote-state.js"
  "docs/church-online-voting-system-design.md"
  "docs/church-voting-openapi.yaml"
  "docs/church-voting-schema.sql"
  "docs/church-voting-ui-checklist.md"
)

echo "[1/4] Cloning target repo: $TARGET_REPO_URL"
rm -rf "$TARGET_DIR"
git clone "$TARGET_REPO_URL" "$TARGET_DIR"

echo "[2/4] Copying church-vote files"
cd "$SOURCE_ROOT"
for f in "${FILES[@]}"; do
  mkdir -p "$TARGET_DIR/$(dirname "$f")"
  cp "$f" "$TARGET_DIR/$f"
  echo "  - copied $f"
done

echo "[3/4] Writing migration note"
cat > "$TARGET_DIR/docs/church-vote-migration-note.md" <<NOTE
# Church Vote Migration Note

Files copied from: $SOURCE_ROOT
Date: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

Remember to manually merge config and route mounting:
- config/index.js: add CHURCH_VOTE_* env keys
- api/index.js: mount /church-vote static + router
NOTE

echo "[4/4] Done"
echo "Target directory: $TARGET_DIR"
echo "Next steps:"
echo "  cd $TARGET_DIR"
echo "  git add ."
echo "  git commit -m 'chore: migrate church vote module from gpt-ai-assistant'"
