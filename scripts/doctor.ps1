# scripts/doctor.ps1
# __DOCTOR_V1__
# Environment sanity check for Para PH Tracker Android builds.
# Run:  .\scripts\doctor.ps1
# Exits 0 if all checks pass, 1 otherwise.

$ErrorActionPreference = 'Continue'
$script:failures = 0
$script:warnings = 0

function Ok($msg)   { Write-Host "  [OK]  $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "  [!!]  $msg" -ForegroundColor Yellow; $script:warnings++ }
function Fail($msg) { Write-Host "  [XX]  $msg" -ForegroundColor Red;    $script:failures++ }
function Section($msg) { Write-Host ""; Write-Host "== $msg ==" -ForegroundColor Cyan }

# --- Working directory ---
Section "Working directory"
$cwd = (Get-Location).Path
if (Test-Path (Join-Path $cwd 'package.json')) {
  Ok "package.json found at $cwd"
} else {
  Fail "package.json not found. Are you in the repo root? Current: $cwd"
}

# --- Node + npm ---
Section "Node + npm"
try {
  $nodeVersion = (& node --version).Trim()
  $nodeMajor = [int](($nodeVersion -replace '^v', '') -split '\.')[0]
  if ($nodeMajor -ge 20) { Ok "node $nodeVersion" }
  else { Fail "node $nodeVersion (need >= 20)" }
} catch { Fail "node not found on PATH" }

try {
  $npmVersion = (& npm --version).Trim()
  Ok "npm $npmVersion"
} catch { Fail "npm not found on PATH" }

# --- Env vars ---
Section "Environment variables"
$androidHome = $env:ANDROID_HOME
if ([string]::IsNullOrEmpty($androidHome)) {
  Fail "ANDROID_HOME not set"
} elseif (-not (Test-Path $androidHome)) {
  Fail "ANDROID_HOME points at missing path: $androidHome"
} else {
  Ok "ANDROID_HOME = $androidHome"
}

$javaHome = $env:JAVA_HOME
if ([string]::IsNullOrEmpty($javaHome)) {
  Fail "JAVA_HOME not set"
} elseif (-not (Test-Path $javaHome)) {
  Fail "JAVA_HOME points at missing path: $javaHome"
} else {
  Ok "JAVA_HOME = $javaHome"
}

# --- adb ---
Section "adb (Android Debug Bridge)"
$adbPath = if ($androidHome) { Join-Path $androidHome 'platform-tools\adb.exe' } else { $null }
if ($adbPath -and (Test-Path $adbPath)) {
  $adbVersion = & $adbPath version 2>&1 | Select-Object -First 1
  Ok "adb: $adbVersion"
} else {
  Fail "adb not found at $adbPath"
}

# --- Android SDK ---
Section "Android SDK"
$platformsDir = if ($androidHome) { Join-Path $androidHome 'platforms' } else { $null }
if ($platformsDir -and (Test-Path $platformsDir)) {
  $platforms = Get-ChildItem $platformsDir -Directory | Select-Object -ExpandProperty Name
  Ok "Platforms installed: $($platforms -join ', ')"
  if ($platforms -contains 'android-36') {
    Ok "android-36 present (matches compileSdk 36)"
  } else {
    Fail "android-36 NOT installed. Run: sdkmanager 'platforms;android-36'"
  }
} else {
  Fail "platforms/ directory missing under ANDROID_HOME"
}

$buildToolsDir = if ($androidHome) { Join-Path $androidHome 'build-tools' } else { $null }
if ($buildToolsDir -and (Test-Path $buildToolsDir)) {
  $bt = Get-ChildItem $buildToolsDir -Directory | Select-Object -ExpandProperty Name
  Ok "Build tools: $($bt -join ', ')"
} else {
  Warn "build-tools/ directory missing"
}

# --- Capacitor project files ---
Section "Capacitor config"
if (Test-Path 'capacitor.config.ts') {
  $cfg = Get-Content 'capacitor.config.ts' -Raw
  if ($cfg -match "from '@capacitor/cli'") {
    Fail "capacitor.config.ts still imports CapacitorConfig from '@capacitor/cli' (breaks on Node 20+). Remove the import."
  } else {
    Ok "capacitor.config.ts parses cleanly"
  }
} else {
  Fail "capacitor.config.ts not found"
}

if (Test-Path 'android/app/src/main/AndroidManifest.xml') {
  Ok "AndroidManifest.xml present"
} else {
  Warn "android/ folder missing — run: npx cap add android"
}

# --- package.json deps ---
Section "Capacitor plugins"
$pkg = Get-Content 'package.json' -Raw | ConvertFrom-Json
$required = @(
  '@capacitor/core',
  '@capacitor/android',
  '@capacitor-community/background-geolocation',
  '@capacitor/local-notifications',
  '@capacitor/preferences'
)
foreach ($dep in $required) {
  if ($pkg.dependencies.PSObject.Properties.Name -contains $dep) {
    $v = $pkg.dependencies.$dep
    Ok "$dep @ $v"
  } else {
    Fail "$dep MISSING from package.json"
  }
}

# --- node_modules ---
Section "Dependencies installed"
if (Test-Path 'node_modules') {
  Ok "node_modules present"
} else {
  Warn "node_modules missing — run: npm install"
}

# --- Gradle wrapper ---
Section "Gradle"
$gradlew = Join-Path $cwd 'android\gradlew.bat'
if (Test-Path $gradlew) {
  Ok "gradlew.bat present"
} else {
  Warn "android/gradlew.bat missing — android platform may not be set up"
}

if (Test-Path 'android\gradle.properties') {
  $gp = Get-Content 'android\gradle.properties' -Raw
  if ($gp -match 'org.gradle.jvmargs=.*Xmx1024m') {
    Ok "Gradle heap capped at 1024m (good for 7 GB RAM machines)"
  } elseif ($gp -match 'org.gradle.jvmargs') {
    $line = ($gp -split "`n" | Where-Object { $_ -match 'org.gradle.jvmargs' }) | Select-Object -First 1
    Warn "Gradle heap not capped at 1024m: $line"
  } else {
    Warn "org.gradle.jvmargs not found in gradle.properties"
  }
} else {
  Warn "android/gradle.properties missing"
}

# --- Keystore (release signing) ---
Section "Release signing"
if (Test-Path 'android\keystore.properties') {
  Ok "android/keystore.properties present"
  $ks = Get-Content 'android\keystore.properties' -Raw
  $ksFile = ($ks -split "`n" | Where-Object { $_ -match '^storeFile=' }) -replace '^storeFile=',''
  $ksFile = $ksFile.Trim()
  # Gradle resolves storeFile relative to android/app/, so try that base
  $candidates = @(
    $ksFile,
    "android\$ksFile",
    "android\app\$ksFile"
  )
  $found = $null
  foreach ($c in $candidates) {
    if (Test-Path $c) { $found = $c; break }
  }
  if ($found) {
    Ok "keystore file found: $found"
  } else {
    Warn "keystore file not found on disk (tried: $($candidates -join ', '))"
  }
} else {
  Warn "android/keystore.properties missing — release builds will fail"
}

# --- Summary ---
Section "Summary"
if ($script:failures -eq 0 -and $script:warnings -eq 0) {
  Write-Host "  ALL CHECKS PASSED" -ForegroundColor Green
  exit 0
} elseif ($script:failures -eq 0) {
  Write-Host "  $($script:warnings) warning(s), 0 failures — build may still work" -ForegroundColor Yellow
  exit 0
} else {
  Write-Host "  $($script:failures) failure(s), $($script:warnings) warning(s)" -ForegroundColor Red
  exit 1
}
