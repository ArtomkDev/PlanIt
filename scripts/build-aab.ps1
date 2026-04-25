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
$sourceAdi = "credentials\adi-registration.properties"
$targetAssets = "android\app\src\main\assets"
if (!(Test-Path -Path $targetAssets)) { New-Item -ItemType Directory -Path $targetAssets | Out-Null }
if (Test-Path -Path $sourceAdi) { Copy-Item -Path $sourceAdi -Destination $targetAssets -Force }
$sourceKey = "credentials\my-release-key.keystore"
$targetKeyDir = "android\app"
if (Test-Path -Path $sourceKey) { Copy-Item -Path $sourceKey -Destination $targetKeyDir -Force }
$sourceGradle = "credentials\build.gradle"
if (Test-Path -Path $sourceGradle) { Copy-Item -Path $sourceGradle -Destination $targetKeyDir -Force }
Write-Host "Starting Gradle AAB (App Bundle) Build..." -ForegroundColor Cyan
cd android
$env:JAVA_HOME="D:\Android\Android Studio\jbr"
.\gradlew bundleRelease
cd ..
if (!(Test-Path -Path $buildsDir)) { New-Item -ItemType Directory -Path $buildsDir | Out-Null }
$aabSource = "android\app\build\outputs\bundle\release\app-release.aab"
$aabDest = "$buildsDir\PlanIt_v$version`_$date.aab"
if (Test-Path -Path $aabSource) {
    Move-Item -Path $aabSource -Destination $aabDest -Force
    Write-Host "AAB Build finished successfully! Saved to: $aabDest" -ForegroundColor Green
} else {
    Write-Host "Build failed. AAB not found." -ForegroundColor Red
}