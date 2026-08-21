$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$originalLocation = Get-Location

function Get-Sha256 {
    param([Parameter(Mandatory = $true)][string]$Path)

    $stream = [System.IO.File]::OpenRead($Path)
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hashBytes = $sha256.ComputeHash($stream)
        return ([System.BitConverter]::ToString($hashBytes)).Replace('-', '').ToLowerInvariant()
    } finally {
        $sha256.Dispose()
        $stream.Dispose()
    }
}

try {
    Set-Location $projectRoot

    if (Test-Path ".env") {
        Get-Content .env | ForEach-Object {
            $line = $_.Trim()
            if ($line -and !$line.StartsWith("#") -and $line.Contains("=")) {
                $name, $value = $line -split '=', 2
                Set-Content "env:$($name.Trim())" $value.Trim()
            }
        }
    }

    # Release artifacts must never inherit the local development test-ad switch.
    $env:EXPO_PUBLIC_FORCE_TEST_ADS = "false"
    $env:PLANIT_BUILD_PLATFORM = "android"
    $env:CI = "1"
    $env:NODE_ENV = "production"

    $packageJson = Get-Content -Raw -Path package.json | ConvertFrom-Json
    $version = $packageJson.version
    $versionParts = $version.Split('.')
    if ($versionParts.Count -ne 3) {
        throw "Expected a semantic app version (major.minor.patch), got '$version'."
    }

    $versionCode = ([int]$versionParts[0] * 10000) +
        ([int]$versionParts[1] * 100) +
        [int]$versionParts[2]
    $date = Get-Date -Format "yyyy-MM-dd_HH-mm"
    $buildsDir = Join-Path $projectRoot "builds"

    Write-Host "1. Running Expo Prebuild (Generating Native Code & Widgets)..." -ForegroundColor Yellow
    & npx expo prebuild --platform android --clean
    if ($LASTEXITCODE -ne 0) {
        throw "Expo prebuild failed with exit code $LASTEXITCODE."
    }

    $sourceAdi = Join-Path $projectRoot "credentials\adi-registration.properties"
    $targetAssets = Join-Path $projectRoot "android\app\src\main\assets"
    if (!(Test-Path -Path $targetAssets)) {
        New-Item -ItemType Directory -Path $targetAssets | Out-Null
    }
    if (Test-Path -Path $sourceAdi) {
        Copy-Item -Path $sourceAdi -Destination $targetAssets -Force
    }

    $sourceKey = Join-Path $projectRoot "credentials\my-release-key.keystore"
    $targetKeyDir = Join-Path $projectRoot "android\app"
    if (Test-Path -Path $sourceKey) {
        Copy-Item -Path $sourceKey -Destination $targetKeyDir -Force
    }

    # Expo config plugins own the generated Gradle properties. Copying the old
    # credentials/gradle.properties over this file silently disabled R8.
    $gradlePropertiesPath = Join-Path $projectRoot "android\gradle.properties"
    $gradleProperties = Get-Content -Raw -LiteralPath $gradlePropertiesPath
    $requiredR8Properties = @(
        "android.enableMinifyInReleaseBuilds",
        "android.enableShrinkResourcesInReleaseBuilds",
        "android.r8.optimizedResourceShrinking"
    )
    foreach ($propertyName in $requiredR8Properties) {
        $propertyPattern = "(?m)^$([regex]::Escape($propertyName))\s*=\s*true\s*$"
        if ($gradleProperties -notmatch $propertyPattern) {
            throw "Release configuration error: '$propertyName=true' is missing after Expo prebuild."
        }
    }
    if ($gradleProperties -notmatch '(?m)^org\.gradle\.jvmargs=.*-Xmx4096m.*-XX:MaxMetaspaceSize=1024m.*$') {
        throw "Release configuration error: Gradle needs 4 GiB heap and 1 GiB metaspace for R8."
    }

    Write-Host "2. Starting Gradle AAB (App Bundle) Build with R8..." -ForegroundColor Cyan
    $env:JAVA_HOME = "D:\Android\Android Studio\jbr"
    $androidDir = Join-Path $projectRoot "android"
    $keystoreAbsPath = Join-Path $androidDir "app\my-release-key.keystore"

    Push-Location $androidDir
    try {
        $gradleArguments = @(
            "bundleRelease",
            "-Pandroid.injected.signing.store.file=$keystoreAbsPath",
            "-Pandroid.injected.signing.store.password=$env:ANDROID_KEYSTORE_PASSWORD",
            "-Pandroid.injected.signing.key.alias=$env:ANDROID_KEYSTORE_ALIAS",
            "-Pandroid.injected.signing.key.password=$env:ANDROID_KEY_PASSWORD"
        )

        & .\gradlew @gradleArguments
        $gradleExitCode = $LASTEXITCODE
        if ($gradleExitCode -ne 0) {
            Write-Host "Gradle failed once; stopping stale daemons and retrying without parallel execution..." -ForegroundColor Yellow
            & .\gradlew --stop
            Start-Sleep -Seconds 2
            & .\gradlew @gradleArguments --no-parallel
            $gradleExitCode = $LASTEXITCODE
        }
        if ($gradleExitCode -ne 0) {
            throw "Gradle bundleRelease failed with exit code $gradleExitCode after one controlled retry."
        }
    } finally {
        Pop-Location
    }

    $aabSource = Join-Path $projectRoot "android\app\build\outputs\bundle\release\app-release.aab"
    $mappingSource = Join-Path $projectRoot "android\app\build\outputs\mapping\release\mapping.txt"

    if (!(Test-Path -LiteralPath $aabSource)) {
        throw "Build failed: release AAB was not generated at '$aabSource'."
    }
    if (!(Test-Path -LiteralPath $mappingSource)) {
        throw "Build failed: R8 mapping.txt was not generated at '$mappingSource'."
    }

    $mappingHeader = (Get-Content -LiteralPath $mappingSource -TotalCount 20) -join "`n"
    if ($mappingHeader -notmatch '(?m)^# compiler: R8\s*$') {
        throw "Build failed: mapping.txt is not a valid R8 mapping file."
    }

    if (!(Test-Path -Path $buildsDir)) {
        New-Item -ItemType Directory -Path $buildsDir | Out-Null
    }

    $artifactBaseName = "PlanIt_v$version`_$date"
    $aabDest = Join-Path $buildsDir "$artifactBaseName.aab"
    $mappingDest = Join-Path $buildsDir "$artifactBaseName-mapping.txt"
    $releaseManifestDest = Join-Path $buildsDir "$artifactBaseName.release.json"

    Copy-Item -LiteralPath $aabSource -Destination $aabDest -Force
    Copy-Item -LiteralPath $mappingSource -Destination $mappingDest -Force

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $bundleArchive = [System.IO.Compression.ZipFile]::OpenRead($aabDest)
    try {
        $embeddedMappingPath = "BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map"
        $mappingEmbeddedInBundle = $null -ne $bundleArchive.GetEntry($embeddedMappingPath)
    } finally {
        $bundleArchive.Dispose()
    }

    $releaseManifest = [ordered]@{
        appVersion = $version
        versionCode = $versionCode
        builtAtUtc = (Get-Date).ToUniversalTime().ToString('o')
        r8Enabled = $true
        mappingEmbeddedInBundle = $mappingEmbeddedInBundle
        aab = [ordered]@{
            file = Split-Path -Leaf $aabDest
            sha256 = Get-Sha256 -Path $aabDest
        }
        deobfuscationMapping = [ordered]@{
            file = Split-Path -Leaf $mappingDest
            sha256 = Get-Sha256 -Path $mappingDest
        }
    }
    $releaseManifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $releaseManifestDest -Encoding UTF8

    Write-Host "AAB build finished successfully:" -ForegroundColor Green
    Write-Host "  Bundle:  $aabDest" -ForegroundColor Green
    Write-Host "  R8 map:  $mappingDest" -ForegroundColor Green
    Write-Host "  Manifest: $releaseManifestDest" -ForegroundColor Green

    if ($mappingEmbeddedInBundle) {
        Write-Host "The R8 mapping is embedded in the AAB; Play should associate it automatically." -ForegroundColor Green
    } else {
        Write-Host "Upload the matching *-mapping.txt as the ReTrace mapping file for this AAB in Play Console." -ForegroundColor Yellow
    }
} catch {
    Write-Error $_
    exit 1
} finally {
    Set-Location $originalLocation
}
