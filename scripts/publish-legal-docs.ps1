param(
  [string]$WebsiteRoot = "",
  [string]$Project = "planit-hub",
  [string]$Target = "legal",
  [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"

$planitRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path

if (-not $WebsiteRoot) {
  $WebsiteRoot = Join-Path $planitRoot "..\planit-website"
}

$websiteRootPath = (Resolve-Path -LiteralPath $WebsiteRoot).Path

if (-not (Test-Path -LiteralPath (Join-Path $websiteRootPath "package.json") -PathType Leaf)) {
  throw "Website package.json was not found in $websiteRootPath."
}

$previousSyncWebsite = $env:PLANIT_LEGAL_SYNC_WEBSITE
Push-Location $planitRoot
try {
  $env:PLANIT_LEGAL_SYNC_WEBSITE = "0"
  npm.cmd run legal:sync
  if ($LASTEXITCODE -ne 0) { throw "App legal document generation failed. Publication stopped." }

  $publishArguments = @(
    "--prefix", $websiteRootPath,
    "run", "legal:publish", "--",
    "-LegalSourceRoot", $planitRoot,
    "-Project", $Project,
    "-Target", $Target
  )
  if ($SkipDeploy) { $publishArguments += "-SkipDeploy" }

  & npm.cmd @publishArguments
  if ($LASTEXITCODE -ne 0) { throw "Legal document publication failed." }
} finally {
  if ($null -eq $previousSyncWebsite) {
    Remove-Item Env:\PLANIT_LEGAL_SYNC_WEBSITE -ErrorAction SilentlyContinue
  } else {
    $env:PLANIT_LEGAL_SYNC_WEBSITE = $previousSyncWebsite
  }
  Pop-Location
}
