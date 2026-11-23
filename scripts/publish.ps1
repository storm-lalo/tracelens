<#
.SYNOPSIS
Publish TraceLens to GitHub in one command.

.DESCRIPTION
Logs in with the GitHub CLI if needed, creates storm-lalo/tracelens if it does
not exist, then pushes the current main branch. The only interactive step is
the first-time GitHub login in your browser.
#>
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$gh = 'C:\Program Files\GitHub CLI\gh.exe'
if (-not (Test-Path $gh)) {
  $gh = (Get-Command gh -ErrorAction SilentlyContinue).Source
}
if (-not $gh) {
  throw 'GitHub CLI is not installed. Run: winget install --id GitHub.cli'
}

Write-Host '==> Checking GitHub authentication'
& $gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host '==> Not logged in. Opening browser for one-time GitHub login...'
  & $gh auth login --web --git-protocol https
  if ($LASTEXITCODE -ne 0) {
    throw 'GitHub login failed.'
  }
}

$owner = 'storm-lalo'
$name = 'tracelens'
$slug = "$owner/$name"

Write-Host "==> Checking whether $slug exists"
& $gh repo view $slug 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "==> Creating $slug (public) and pushing main"
  & $gh repo create $slug --public --source=. --remote=origin --push
} else {
  Write-Host "==> Repository exists; pushing main"
  git remote set-url origin "https://github.com/$slug.git"
  git push -u origin main
}

if ($LASTEXITCODE -ne 0) {
  throw 'Publish failed. Check the output above.'
}

Write-Host ''
Write-Host "Done: https://github.com/$slug"
