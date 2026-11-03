param(
    [ValidateSet("armeabi-v7a", "arm64-v8a", "x86", "x86_64")]
    [string[]]$Architectures = @(),
    [switch]$Install,
    [string]$DeviceSerial
)

$ErrorActionPreference = "Stop"

function Assert-DevelopmentApk {
    param([string]$Path, [string]$AaptPath)

    if (!(Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Development APK was not generated at '$Path'."
    }
    $badging = @(& $AaptPath dump badging $Path)
    if ($LASTEXITCODE -ne 0) { throw "Unable to inspect the APK build type." }
    if ($badging -notcontains "application-debuggable") {
        throw "Refusing a non-debuggable APK: local development requires a dev build."
    }
    $manifest = @(& $AaptPath dump xmltree $Path AndroidManifest.xml)
    if ($LASTEXITCODE -ne 0) { throw "Unable to inspect the APK manifest." }
    if (!($manifest -match 'expo\.modules\.devlauncher\.launcher\.DevLauncherActivity')) {
        throw "Refusing an APK without Expo Dev Client."
    }
    $packageLine = $badging | Where-Object { $_ -match "^package: name='([^']+)'" } | Select-Object -First 1
    if (!$packageLine) { throw "The APK package name is missing." }
    return [regex]::Match($packageLine, "^package: name='([^']+)'").Groups[1].Value
}

$PROJECT_ROOT = Split-Path -Parent $PSScriptRoot
$ANDROID_DIR = Join-Path $PROJECT_ROOT "android"

if ($Install -and [string]::IsNullOrWhiteSpace($DeviceSerial)) {
    throw "Specify -DeviceSerial when installing a development build."
}
# Google Sign-In accepts only the debug certificate registered in Firebase;
# prebuild's android/app/debug.keystore is the public template key.
$DEBUG_KEYSTORE = Join-Path $PROJECT_ROOT "credentials\debug.keystore"
if (!(Test-Path -LiteralPath $DEBUG_KEYSTORE -PathType Leaf)) {
    throw "Development signing keystore is missing at '$DEBUG_KEYSTORE'."
}
$SDK_PATH = $env:ANDROID_HOME
if (!$SDK_PATH) { $SDK_PATH = $env:ANDROID_SDK_ROOT }
if (!$SDK_PATH -and (Test-Path -LiteralPath (Join-Path $ANDROID_DIR "local.properties"))) {
    $sdkProperty = Select-String -LiteralPath (Join-Path $ANDROID_DIR "local.properties") -Pattern '^\s*sdk\.dir\s*=' | Select-Object -First 1
    if ($sdkProperty) { $SDK_PATH = ($sdkProperty.Line -split '=', 2)[1].Trim().Replace('\\', '\').Replace('\:', ':') }
}
if (!$SDK_PATH) { throw "Set ANDROID_HOME to the Android SDK before building." }
$env:ANDROID_HOME = (Resolve-Path -LiteralPath $SDK_PATH).Path
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$AAPT_PATH = Get-ChildItem -LiteralPath (Join-Path $env:ANDROID_HOME "build-tools") -Directory |
    Sort-Object Name -Descending |
    ForEach-Object { Join-Path $_.FullName "aapt.exe" } |
    Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
    Select-Object -First 1
if (!$AAPT_PATH) { throw "Android SDK Build Tools are required to verify the development APK." }

Write-Host "--- Starting Development Build (Debug APK) ---" -ForegroundColor Cyan

Set-Location $PROJECT_ROOT

# Debug APKs must use Google's demo ad inventory even when local env values
# contain valid production AdMob identifiers.
$env:EXPO_PUBLIC_FORCE_TEST_ADS = "true"
$env:PLANIT_BUILD_PLATFORM = "android"
$env:NODE_ENV = "development"

Write-Host "Step 1: Running Expo Prebuild..." -ForegroundColor Yellow
npx expo prebuild --platform android --no-install

if ($LASTEXITCODE -ne 0) {
    Write-Host "Prebuild failed!" -ForegroundColor Red
    exit $LASTEXITCODE
}

Set-Location $ANDROID_DIR

# Задаємо JAVA_HOME ідентично до release-скриптів для консистентності середовища
$env:JAVA_HOME="D:\Android\Android Studio\jbr"

Write-Host "Step 2: Building Debug APK (assembleDebug)..." -ForegroundColor Yellow
$gradleArguments = @(
    ':app:assembleDebug',
    '--max-workers=2',
    "-Pandroid.injected.signing.store.file=$DEBUG_KEYSTORE",
    '-Pandroid.injected.signing.store.password=android',
    '-Pandroid.injected.signing.key.alias=androiddebugkey',
    '-Pandroid.injected.signing.key.password=android'
)
if ($Architectures.Count -gt 0) { $gradleArguments += "-PreactNativeArchitectures=$($Architectures -join ',')" }
& .\gradlew @gradleArguments

if ($LASTEXITCODE -ne 0) {
    Write-Host "Gradle build failed!" -ForegroundColor Red
    Set-Location $PROJECT_ROOT
    exit $LASTEXITCODE
}

Set-Location $PROJECT_ROOT
$APK_PATH = Join-Path $ANDROID_DIR "app\build\outputs\apk\debug\app-debug.apk"
$PACKAGE_NAME = Assert-DevelopmentApk -Path $APK_PATH -AaptPath $AAPT_PATH
$BUILDS_DIR = Join-Path $PROJECT_ROOT "builds"

if (!(Test-Path -Path $BUILDS_DIR)) {
    New-Item -ItemType Directory -Path $BUILDS_DIR | Out-Null
}

$date = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$DEST_PATH = Join-Path $BUILDS_DIR "PlanIt-Dev_$date.apk"

Copy-Item -Path $APK_PATH -Destination $DEST_PATH -Force

if ($Install) {
    $ADB_PATH = Join-Path $env:ANDROID_HOME "platform-tools\adb.exe"
    & $ADB_PATH -s $DeviceSerial install -r $DEST_PATH
    if ($LASTEXITCODE -ne 0) { throw "Development APK installation failed; device data was retained." }
    $installedPackage = @(& $ADB_PATH -s $DeviceSerial shell dumpsys package $PACKAGE_NAME)
    if ($LASTEXITCODE -ne 0 -or !($installedPackage -match '\bDEBUGGABLE\b')) {
        throw "The installed package is not a verified development build."
    }
    Write-Host "Verified development client installed on $DeviceSerial." -ForegroundColor Green
}

Write-Host "`n--- SUCCESS! ---" -ForegroundColor Green
Write-Host "Development APK created at: $DEST_PATH" -ForegroundColor White
if (!$Install) { Write-Host "Install this APK on your device/emulator." -ForegroundColor Cyan }
Write-Host "Then run: npm run dev-start" -ForegroundColor Yellow

Set-Location $PROJECT_ROOT
