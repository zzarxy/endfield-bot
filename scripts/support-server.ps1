# Sets up the support server with the bot's token (input hidden): shows the planned changes, then applies them after "y".
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
$secure = Read-Host "Bot Token" -AsSecureString
$env:DISCORD_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)).Trim()
try {
  npx tsx scripts/support-server.ts
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  $answer = Read-Host "Apply these changes? (y/N)"
  if ($answer -eq "y") { npx tsx scripts/support-server.ts --apply }
} finally { Remove-Item Env:DISCORD_TOKEN -ErrorAction SilentlyContinue }
