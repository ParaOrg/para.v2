# scripts/build.ps1
# __BUILD_V1__
# One-command build for Para PH Tracker.
# Builds web bundle, syncs to Android, produces a release APK.
#
# Usage:
#   .\scripts\build.ps1                # release build (needs keystore)
#   .\scripts\build.ps1 -Mode debug    # debug build (no keystore needed)
#   .\scripts\build.ps1 -SkipDoctor    # bypass environment check
#   .\scripts\build.ps1 -Install       # also adb install to connected device

param(
  [ValidateSet('debug','release')]
  [string]$Mode = 'release',
  [switch]$SkipDoctor,
  [switch]$Install
)

$ErrorActionPreference = 'Stop'
$repoRoot = $PSScriptRoot | Split-Path -Parent
Set-Location $repoRoot

Write-Host ""
Write-Host "== Para PH Tracker build ==" -ForegroundColor Cyan
Write-Host "   mode: $Mode"
Write-Host "   root: $repoRoot"
Write-Host ""

# --- 1. Optional doctor ---
if (-not $SkipDoctor) {
  Write-Host "[1/6] Environment check..." -ForegroundColor Cyan
  & (Join-Path $PSScriptRoot 'doctor.ps1')
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Doctor failed. Fix issues above, or rerun with -SkipDoctor." -ForegroundColor Red
    exit 1
  }
} else {
  Write-Host "[1/6] Environment check skipped" -ForegroundColor DarkGray
}

# --- 2. Web build ---
Write-Host "[2/6] Building web bundle..." -ForegroundColor Cyan
& npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

# --- 3. Capacitor sync ---
Write-Host "[3/6] Syncing to Android..." -ForegroundColor Cyan
& npx cap sync
if ($LASTEXITCODE -ne 0) { throw "npx cap sync failed" }

# --- 4. Gradle build ---
Write-Host "[4/6] Gradle build ($Mode)..." -ForegroundColor Cyan
Push-Location android
try {
  if ($Mode -eq 'release') {
    & .\gradlew.bat clean assembleRelease
  } else {
    & .\gradlew.bat clean assembleDebug
  }
  if ($LASTEXITCODE -ne 0) { throw "gradlew failed" }
} finally {
  Pop-Location
}

# --- 5. Copy artifact ---
Write-Host "[5/6] Copying artifact..." -ForegroundColor Cyan
$srcApk = if ($Mode -eq 'release') {
  "android\app\build\outputs\apk\release\app-release.apk"
} else {
  "android\app\build\outputs\apk\debug\app-debug.apk"
}
if (-not (Test-Path $srcApk)) { throw "APK not found at $srcApk" }

$pkg = Get-Content 'package.json' -Raw | ConvertFrom-Json
$version = $pkg.version

$artifactDir = Join-Path $repoRoot 'dist-artifacts'
New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null

$timestamp = Get-Date -Format 'yyyyMMdd-HHmm'
$destApk = Join-Path $artifactDir "tracker-v$version-$Mode-$timestamp.apk"
Copy-Item $srcApk $destApk

$sizeMB = [math]::Round((Get-Item $destApk).Length / 1MB, 2)
Write-Host "   -> $destApk ($sizeMB MB)" -ForegroundColor Green

# --- 6. Optional install ---
if ($Install) {
  Write-Host "[6/6] Installing to device..." -ForegroundColor Cyan
  $adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
  & $adb install -r $destApk
  if ($LASTEXITCODE -ne 0) { throw "adb install failed" }
} else {
  Write-Host "[6/6] Install skipped (-Install not passed)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "== Build complete ==" -ForegroundColor Green
Write-Host "   $destApk"
Write-Host ""
