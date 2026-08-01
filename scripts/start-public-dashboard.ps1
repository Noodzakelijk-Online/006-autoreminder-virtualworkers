param(
  [switch]$NoBuild
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$composeEnvPath = Join-Path $repoRoot ".env.db.local"
$stateDirectory = Join-Path $repoRoot ".local"
$statePath = Join-Path $stateDirectory "public-dashboard.json"

function Import-DotEnv([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Missing ignored Docker environment file: $Path"
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') { continue }
    $name = $matches[1]
    $value = $matches[2].Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

function Invoke-Checked([string[]]$Arguments) {
  & docker @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Docker command failed: docker $($Arguments -join ' ')"
  }
}

function Wait-Http([string]$Url, [int]$TimeoutSeconds = 180) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) { return $response }
    } catch {
      Start-Sleep -Seconds 2
    }
  } while ((Get-Date) -lt $deadline)
  throw "Timed out waiting for $Url"
}

function Wait-NgrokTunnel([string]$InspectUrl, [int]$TimeoutSeconds = 90) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $InspectUrl -TimeoutSec 5
      $tunnels = ($response.Content | ConvertFrom-Json).tunnels
      $publicUrl = $tunnels |
        Where-Object { $_.proto -eq "https" } |
        Select-Object -First 1 -ExpandProperty public_url
      if ($publicUrl) { return $publicUrl }
    } catch {
      # The inspection endpoint is briefly unavailable while ngrok connects.
    }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  throw "ngrok did not publish an HTTPS tunnel. Check for an endpoint conflict or configure NGROK_URL."
}

Set-Location $repoRoot
Import-DotEnv $composeEnvPath

$defaults = @{
  PORT = "3025"
  MYSQL_PORT = "3307"
  MYSQL_VOLUME_NAME = "joyce-work-schedule_joyce_mysql_data"
  NGROK_INSPECT_PORT = "4041"
}
foreach ($entry in $defaults.GetEnumerator()) {
  if (-not [Environment]::GetEnvironmentVariable($entry.Key, "Process")) {
    [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, "Process")
  }
}

$required = @(
  "MYSQL_ROOT_PASSWORD",
  "MYSQL_DATABASE",
  "MYSQL_USER",
  "MYSQL_PASSWORD",
  "REDIS_PASSWORD",
  "NGROK_AUTHTOKEN"
)
foreach ($name in $required) {
  if (-not [Environment]::GetEnvironmentVariable($name, "Process")) {
    throw "$name is required in .env.db.local"
  }
}

$compose = @("compose", "--env-file", $composeEnvPath, "--profile", "public")
Invoke-Checked ($compose + @("config", "--quiet"))

$upArguments = $compose + @("up", "-d")
if (-not $NoBuild) { $upArguments += "--build" }
Invoke-Checked $upArguments

$localHealth = "http://127.0.0.1:$($env:PORT)/api/health"
Wait-Http $localHealth | Out-Null

$configuredPublicUrl = [Environment]::GetEnvironmentVariable("NGROK_URL", "Process")
if ($configuredPublicUrl) {
  $publicUrl = $configuredPublicUrl.Trim().TrimEnd("/")
} else {
  $inspectUrl = "http://127.0.0.1:$($env:NGROK_INSPECT_PORT)/api/tunnels"
  $publicUrl = Wait-NgrokTunnel $inspectUrl
}

$env:PUBLIC_URL = $publicUrl
$env:WEBHOOK_BASE_URL = $publicUrl
$env:TRELLO_WEBHOOK_CALLBACK_URL = "$publicUrl/api/trello-webhook"
Invoke-Checked ($compose + @("up", "-d", "--force-recreate", "app"))

Wait-Http $localHealth | Out-Null
$publicHealth = "$publicUrl/api/health"
$health = Wait-Http $publicHealth

New-Item -ItemType Directory -Force -Path $stateDirectory | Out-Null
[ordered]@{
  publicUrl = $publicUrl
  healthUrl = $publicHealth
  webhookUrl = "$publicUrl/api/trello-webhook"
  localUrl = "http://127.0.0.1:$($env:PORT)"
  startedAt = (Get-Date).ToUniversalTime().ToString("o")
  statusCode = $health.StatusCode
} | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8

Write-Output "Joyce dashboard is healthy: $publicUrl"
Write-Output "Local fallback: http://127.0.0.1:$($env:PORT)"
Write-Output "Runtime state: $statePath"
