param(
    [ValidateSet("production", "test")]
    [string]$AdsMode = "production"
)

$ErrorActionPreference = "Stop"
& (Join-Path $PSScriptRoot "build-aab.ps1") -ArtifactType apk -AdsMode $AdsMode
