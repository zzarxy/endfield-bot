# Asks for the Discord app credentials (token input is hidden) and runs scripts/connect.ts.
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
$env:DISCORD_APP_ID = (Read-Host "Application ID").Trim()
$env:DISCORD_PUBLIC_KEY = (Read-Host "Public Key").Trim()
$secure = Read-Host "Bot Token" -AsSecureString
$env:DISCORD_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)).Trim()
try {
    npx tsx scripts/connect.ts
} finally {
    Remove-Item Env:DISCORD_TOKEN -ErrorAction SilentlyContinue
}
