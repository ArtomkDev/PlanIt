if (Test-Path ".env") {
    Get-Content .env | ForEach-Object {
        $line = $_.Trim()
        if ($line -and !$line.StartsWith("#") -and $line.Contains("=")) {
            $name, $value = $line -split '=', 2
            Set-Content "env:$($name.Trim())" $value.Trim()
        }
    }
}

$packageJson = Get-Content -Raw -Path package.json | ConvertFrom-Json
$version = $packageJson.version
$date = Get-Date -Format "yyyy-MM-dd_HH-mm"
$buildsDir = "D:\GitHub\ArtomkDev\PlanIt\builds"

Write-Host "1. Running Expo Prebuild (Generating Native Code & Widgets)..." -ForegroundColor Yellow

npx expo prebuild --platform android --clean --no-interactive

$sourceAdi = "credentials\adi-registration.properties"
$targetAssets = "android\app\src\main\assets"
if (!(Test-Path -Path $targetAssets)) { New-Item -ItemType Directory -Path $targetAssets | Out-Null }
if (Test-Path -Path $sourceAdi) { Copy-Item -Path $sourceAdi -Destination $targetAssets -Force }

$sourceKey = "credentials\my-release-key.keystore"
$targetKeyDir = "android\app"
if (Test-Path -Path $sourceKey) { Copy-Item -Path $sourceKey -Destination $targetKeyDir -Force }

Write-Host "2. Starting Gradle Signed Release Build..." -ForegroundColor Cyan
cd android
$env:JAVA_HOME="D:\Android\Android Studio\jbr"
.\gradlew assembleRelease
cd ..

if (!(Test-Path -Path $buildsDir)) { New-Item -ItemType Directory -Path $buildsDir | Out-Null }

$apkSource = "android\app\build\outputs\apk\release\app-release.apk"
$apkDest = "$buildsDir\PlanIt_v$version`_$date.apk"

if (Test-Path -Path $apkSource) {
    Move-Item -Path $apkSource -Destination $apkDest -Force
    Write-Host "Build finished successfully! Saved to: $apkDest" -ForegroundColor Green
} else {
    Write-Host "Build failed. APK not found." -ForegroundColor Red
}