param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $GraphifyArgs
)

$ErrorActionPreference = "Stop"

$graphifyPath = $env:GRAPHIFY_BIN

if (-not $graphifyPath) {
  $graphifyCommand = Get-Command graphify -ErrorAction SilentlyContinue
  if ($graphifyCommand) {
    $graphifyPath = $graphifyCommand.Source
  }
}

if (-not $graphifyPath -and (Test-Path ".graphify-local.json")) {
  $localConfig = Get-Content ".graphify-local.json" -Raw | ConvertFrom-Json
  if ($localConfig.bin -and (Test-Path $localConfig.bin)) {
    $graphifyPath = $localConfig.bin
  }
}

if (-not $graphifyPath -and (Test-Path ".codex/hooks.json")) {
  $hooks = Get-Content ".codex/hooks.json" -Raw | ConvertFrom-Json
  $hookCommand = $hooks.hooks.PreToolUse[0].hooks[0].command
  if ($hookCommand -match "^(.*graphify(?:\.exe)?)\s+hook-check$") {
    $candidate = $matches[1]
    if (Test-Path $candidate) {
      $graphifyPath = $candidate
    }
  }
}

if (-not $graphifyPath) {
  Write-Host "Graphify CLI was not found. Install the official CLI first: uv tool install graphifyy (recommended) or pipx install graphifyy. Then rerun this npm script."
  exit 1
}

if (-not $GraphifyArgs -or $GraphifyArgs.Count -eq 0) {
  $GraphifyArgs = @(".")
}

& $graphifyPath @GraphifyArgs
exit $LASTEXITCODE
