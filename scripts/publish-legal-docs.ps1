param(
  [string]$WebsiteRoot = "",
  [string]$Project = "planit-hub",
  [string]$Target = "legal",
  [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"

$planitRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")

if (-not $WebsiteRoot) {
  $WebsiteRoot = Join-Path $planitRoot "..\planit-website"
}

$websiteRootPath = Resolve-Path -LiteralPath $WebsiteRoot
$websitePublicLegalDir = Join-Path $websiteRootPath "public\content\legal"
$websiteOutDir = Join-Path $websiteRootPath "out"
$websiteOutLegalDir = Join-Path $websiteOutDir "content\legal"

if (-not (Test-Path -LiteralPath $websitePublicLegalDir -PathType Container)) {
  New-Item -ItemType Directory -Force -Path $websitePublicLegalDir | Out-Null
}

Push-Location $planitRoot
try {
  $previousWebsiteDir = $env:PLANIT_LEGAL_WEBSITE_DIR
  $previousLoadingOutputDir = $env:PLANIT_LEGAL_LOADING_OUTPUT_DIR
  $env:PLANIT_LEGAL_WEBSITE_DIR = $websitePublicLegalDir
  $env:PLANIT_LEGAL_LOADING_OUTPUT_DIR = $websitePublicLegalDir
  npm.cmd run legal:sync
  npm.cmd run legal:loading
} finally {
  if ($null -eq $previousWebsiteDir) {
    Remove-Item Env:\PLANIT_LEGAL_WEBSITE_DIR -ErrorAction SilentlyContinue
  } else {
    $env:PLANIT_LEGAL_WEBSITE_DIR = $previousWebsiteDir
  }
  if ($null -eq $previousLoadingOutputDir) {
    Remove-Item Env:\PLANIT_LEGAL_LOADING_OUTPUT_DIR -ErrorAction SilentlyContinue
  } else {
    $env:PLANIT_LEGAL_LOADING_OUTPUT_DIR = $previousLoadingOutputDir
  }
  Pop-Location
}

Push-Location $websiteRootPath
try {
  npm.cmd run legal:manifest

  if (-not (Test-Path -LiteralPath $websiteOutDir -PathType Container)) {
    throw "Build output folder was not found: $websiteOutDir. Run npm.cmd run build:firebase in the website repo once, then publish legal docs again."
  }

  New-Item -ItemType Directory -Force -Path $websiteOutLegalDir | Out-Null
  Remove-Item -Force -Path (Join-Path $websitePublicLegalDir "*.skeleton.html") -ErrorAction SilentlyContinue
  Remove-Item -Force -Path (Join-Path $websiteOutLegalDir "*.skeleton.html") -ErrorAction SilentlyContinue
  Copy-Item -Force -Path (Join-Path $websitePublicLegalDir "*.mdx") -Destination $websiteOutLegalDir
  Copy-Item -Force -LiteralPath (Join-Path $websitePublicLegalDir "manifest.json") -Destination (Join-Path $websiteOutLegalDir "manifest.json")

  if ($SkipDeploy) {
    Write-Host "Prepared legal MDX in $websiteOutLegalDir. Firebase deploy skipped."
    return
  }

  npm.cmd exec -- firebase deploy --only "hosting:$Target" --project $Project
} finally {
  Pop-Location
}
