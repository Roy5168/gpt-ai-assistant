param(
  [string]$TargetRepoUrl = 'https://github.com/Roy5168/Codex.git',
  [string]$TargetDir = "$env:TEMP\Codex"
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

$Files = @(
  'api/church-vote.js',
  'api/public/church-vote-admin.html',
  'api/public/church-vote-voter.html',
  'services/church-vote-state.js',
  'docs/church-online-voting-system-design.md',
  'docs/church-voting-openapi.yaml',
  'docs/church-voting-schema.sql',
  'docs/church-voting-ui-checklist.md'
)

Write-Host "[1/4] Cloning target repo: $TargetRepoUrl"
if (Test-Path $TargetDir) {
  Remove-Item -Path $TargetDir -Recurse -Force
}

git clone $TargetRepoUrl $TargetDir

Write-Host '[2/4] Copying church-vote files'
foreach ($file in $Files) {
  $src = Join-Path $Root $file
  $dst = Join-Path $TargetDir $file
  $dstDir = Split-Path -Parent $dst
  New-Item -ItemType Directory -Path $dstDir -Force | Out-Null
  Copy-Item -Path $src -Destination $dst -Force
  Write-Host "  - copied $file"
}

Write-Host '[3/4] Writing migration note'
$note = @"
# Church Vote Migration Note

Files copied from: $Root
Date: $(Get-Date -Format o)

Remember to manually merge config and route mounting:
- config/index.js: add CHURCH_VOTE_* env keys
- api/index.js: mount /church-vote static + router
"@

$noteDir = Join-Path $TargetDir 'docs'
New-Item -ItemType Directory -Path $noteDir -Force | Out-Null
Set-Content -Path (Join-Path $noteDir 'church-vote-migration-note.md') -Value $note -Encoding UTF8

Write-Host '[4/4] Done'
Write-Host "Target directory: $TargetDir"
Write-Host 'Next steps:'
Write-Host "  cd $TargetDir"
Write-Host '  git add .'
Write-Host "  git commit -m 'chore: migrate church vote module from gpt-ai-assistant'"
