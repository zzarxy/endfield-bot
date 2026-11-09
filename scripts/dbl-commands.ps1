# Asks for the discordbotlist.com token (hidden) and sends the command list.
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
$secure = Read-Host "discordbotlist API token" -AsSecureString
$env:DBL_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)).Trim()
try { npx tsx scripts/dbl-commands.ts } finally { Remove-Item Env:DBL_TOKEN -ErrorAction SilentlyContinue }
