# 為什麼你在 `Roy5168/Codex` 看不到程式

你目前看不到程式，是因為這個執行環境無法直接連到 GitHub（clone/push 會回 `403`），所以我無法直接把 commit 推到你的 `Roy5168/Codex`。

已提供兩種搬遷方式：

1. 直接搬遷（有 GitHub 網路時）
   - `scripts/move-church-vote-to-codex.sh`
2. 匯出離線套件（最穩定）
   - `scripts/export-church-vote-package.sh`

## 建議你現在做

在你自己的電腦執行：

```bash
bash scripts/export-church-vote-package.sh /tmp/church-vote-package
```

然後把 `/tmp/church-vote-package/files/*` 複製進 `https://github.com/Roy5168/Codex` 的工作目錄，
依照 `APPLY_STEPS.md` 合併 `api/index.js` 與 `config/index.js` 後 commit/push。

### Windows PowerShell 版本

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\export-church-vote-package.ps1 `
  -OutDir \"$env:TEMP\\church-vote-package\"
```

輸出 zip 檔預設在：`$env:TEMP\\church-vote-package.zip`。
