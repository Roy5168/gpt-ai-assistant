# Church Vote 搬遷到 `Roy5168/Codex` 指引

由於目前執行環境對 GitHub 網路連線回傳 `403`，無法直接在此環境完成遠端 clone/push。

已提供自動化搬遷腳本：

```bash
bash scripts/move-church-vote-to-codex.sh \
  https://github.com/Roy5168/Codex.git \
  /tmp/Codex
```

Windows PowerShell：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\move-church-vote-to-codex.ps1 `
  -TargetRepoUrl \"https://github.com/Roy5168/Codex.git\" `
  -TargetDir \"$env:TEMP\\Codex\"
```

腳本會搬移以下線上投票相關檔案：

- `api/church-vote.js`
- `api/public/church-vote-admin.html`
- `api/public/church-vote-voter.html`
- `services/church-vote-state.js`
- `docs/church-online-voting-system-design.md`
- `docs/church-voting-openapi.yaml`
- `docs/church-voting-schema.sql`
- `docs/church-voting-ui-checklist.md`

並在目標 repo 產生 `docs/church-vote-migration-note.md`。

## 目標 repo 還需要手動合併

- `config/index.js`：加入 `CHURCH_VOTE_*` 變數
- `api/index.js`：掛載 `/church-vote` router 和 static
