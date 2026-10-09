# Builds the web app in server mode and publishes dist/ to the gh-pages branch.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1 -CoAuthor "Claude Haiku 5.5 <noreply@anthropic.com>"
param([Parameter(Mandatory)][string]$CoAuthor)

$ErrorActionPreference = 'Stop'
$work = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$repo = (Resolve-Path (Join-Path $work '..')).Path
$wt = 'C:\Users\A\dev\claude-work\pages'
$envFile = Join-Path $work '.env'

function Remove-Worktree {
  # Leave the worktree folder before removing it, otherwise removal fails.
  Set-Location $env:USERPROFILE
  if (Test-Path $wt) {
    git -C $repo worktree remove --force $wt 2>$null | Out-Null
    if (Test-Path $wt) { Remove-Item -Recurse -Force $wt -ErrorAction SilentlyContinue }
  }
  git -C $repo worktree prune
}

# 1) Server settings must exist. Values are never printed.
if (-not (Test-Path $envFile)) { throw '서버 모드로 빌드할 수 없습니다: mobile-web\.env 파일이 없습니다.' }
$envText = Get-Content $envFile -Raw
$url = [regex]::Match($envText, '(?m)^VITE_SUPABASE_URL=(.+)$').Groups[1].Value.Trim()
$key = [regex]::Match($envText, '(?m)^VITE_SUPABASE_ANON_KEY=(.+)$').Groups[1].Value.Trim()
if (-not $url -or -not $key) { throw '서버 모드로 빌드할 수 없습니다: .env의 URL 또는 키 값이 비어 있습니다.' }
$serverHost = ([uri]$url).Host

# 2) Only committed code may be deployed.
$dirty = git -C $repo status --porcelain
if ($dirty) { throw "커밋되지 않은 변경이 있습니다. 먼저 커밋하세요:`n$dirty" }

# 3) Build.
Push-Location $work
try {
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'npm run build 실패' }
} finally {
  Pop-Location
}

# 4) The bundle must point at the Supabase server.
$hit = Select-String -Path (Join-Path $work 'dist\assets\*.js') -SimpleMatch $serverHost -List
if (-not $hit) { throw 'dist 번들에 서버 주소가 없습니다. 서버 모드 빌드가 아닙니다.' }

# 5) Fresh gh-pages worktree.
Remove-Worktree
git -C $repo fetch origin gh-pages
if ($LASTEXITCODE -ne 0) { throw 'gh-pages fetch 실패' }
git -C $repo worktree add $wt origin/gh-pages
git -C $wt checkout -B gh-pages origin/gh-pages | Out-Null

try {
  # 6) Replace everything except .git with the new build.
  Get-ChildItem $wt -Force | Where-Object { $_.Name -ne '.git' } | Remove-Item -Recurse -Force
  Copy-Item (Join-Path $work 'dist\*') $wt -Recurse -Force
  New-Item -ItemType File -Force -Path (Join-Path $wt '.nojekyll') | Out-Null

  # 7) Nothing to publish?
  git -C $wt add -A
  $changes = git -C $wt status --porcelain
  if (-not $changes) {
    Write-Output '배포할 변경이 없습니다.'
    return
  }

  # 8) Commit from a file (multi-line -m breaks in PowerShell) and push.
  $sha = git -C $repo rev-parse --short HEAD
  $msgFile = 'C:\Users\A\dev\claude-work\deploy-msg-auto.txt'
  [IO.File]::WriteAllText($msgFile, "Deploy web build from main $sha`n`nCo-Authored-By: $CoAuthor", (New-Object Text.UTF8Encoding $false))
  git -C $wt commit -F $msgFile | Out-Null
  git -C $wt push origin gh-pages
  if ($LASTEXITCODE -ne 0) { throw 'gh-pages push 실패' }

  # 10) Report the new bundle name.
  $newJs = (Get-ChildItem (Join-Path $wt 'assets') -Filter 'index-*.js' | Select-Object -First 1).Name
  Write-Output "배포 완료. 새 번들: $newJs"
  Write-Output '1~2분 뒤 Actions의 pages-build-deployment 성공 여부를 확인하세요.'
} finally {
  # 9) Always clean up the worktree.
  Remove-Worktree
}
