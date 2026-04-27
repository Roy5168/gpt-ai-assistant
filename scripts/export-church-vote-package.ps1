param(
  [string]$OutDir = "$env:TEMP\church-vote-package"
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

$Files = @(
  'api/church-vote.js',
  'api/public/church-vote-admin.html',
  'api/public/church-vote-voter.html',
  'services/church-vote-state.js',
  'docs/church-online-voting-system-design.md',
  'docs/church-vote-migration-to-codex.md',
  'docs/church-voting-openapi.yaml',
  'docs/church-voting-schema.sql',
  'docs/church-voting-ui-checklist.md',
  'scripts/move-church-vote-to-codex.sh'
)

if (Test-Path $OutDir) {
  Remove-Item -Path $OutDir -Recurse -Force
}

New-Item -ItemType Directory -Path "$OutDir\files" -Force | Out-Null

foreach ($file in $Files) {
  $src = Join-Path $Root $file
  $dst = Join-Path "$OutDir\files" $file
  $dstDir = Split-Path -Parent $dst
  New-Item -ItemType Directory -Path $dstDir -Force | Out-Null
  Copy-Item -Path $src -Destination $dst -Force
  Write-Host "copied $file"
}

$apply = @'
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
'@

Set-Content -Path (Join-Path $OutDir 'APPLY_STEPS.md') -Value $apply -Encoding UTF8

$zipPath = "$OutDir.zip"
if (Test-Path $zipPath) {
  Remove-Item -Path $zipPath -Force
}
Compress-Archive -Path "$OutDir\*" -DestinationPath $zipPath

Write-Host "Package directory: $OutDir"
Write-Host "Zip package: $zipPath"
