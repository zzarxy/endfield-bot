# Sets up the support server with the bot's token (saved with DPAPI, asked once): shows the planned changes,
# then applies them after "y". Add -Yes to apply without the prompt.
param([switch]$Yes)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
. "$PSScriptRoot\bot-token.ps1"
Use-BotToken
try {
  npx tsx scripts/support-server.ts
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  if ($Yes -or (Read-Host "Apply these changes? (y/N)") -eq "y") { npx tsx scripts/support-server.ts --apply }
} finally { Remove-Item Env:DISCORD_TOKEN -ErrorAction SilentlyContinue }
