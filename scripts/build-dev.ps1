# Знаходимо корінь проекту відносно розташування самого скрипта (/scripts/..)
$PROJECT_ROOT = Split-Path -Parent $PSScriptRoot
$ANDROID_DIR = Join-Path $PROJECT_ROOT "android"

Write-Host "--- Starting Development Build (Debug APK) ---" -ForegroundColor Cyan

Set-Location $PROJECT_ROOT

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
.\gradlew assembleDebug

if ($LASTEXITCODE -ne 0) {
    Write-Host "Gradle build failed!" -ForegroundColor Red
    Set-Location $PROJECT_ROOT
    exit $LASTEXITCODE
}

$APK_PATH = Join-Path $ANDROID_DIR "app\build\outputs\apk\debug\app-debug.apk"
$BUILDS_DIR = Join-Path $PROJECT_ROOT "builds"

if (!(Test-Path -Path $BUILDS_DIR)) {
    New-Item -ItemType Directory -Path $BUILDS_DIR | Out-Null
}

$date = Get-Date -Format "yyyy-MM-dd_HH-mm"
$DEST_PATH = Join-Path $BUILDS_DIR "PlanIt-Dev_$date.apk"

Copy-Item -Path $APK_PATH -Destination $DEST_PATH -Force

Write-Host "`n--- SUCCESS! ---" -ForegroundColor Green
Write-Host "Development APK created at: $DEST_PATH" -ForegroundColor White
Write-Host "Install this APK on your device/emulator." -ForegroundColor Cyan
Write-Host "Then run: npm run dev-start" -ForegroundColor Yellow

Set-Location $PROJECT_ROOT