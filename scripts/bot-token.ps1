# Stores the Discord bot token encrypted with Windows DPAPI (only this Windows user on this PC can decrypt it)
# and loads it into $env:DISCORD_TOKEN for the current script. The token is never printed.
#   . .\scripts\bot-token.ps1            # dot-source, then call Use-BotToken
#   powershell -File scripts\bot-token.ps1 -Reset   # replace the saved token (e.g. after Reset Token)
param([switch]$Reset)
$TokenFile = Join-Path $env:USERPROFILE ".endfield-bot\token.dpapi"
$AppId = "1568475342174162947"

function Test-BotToken([string]$token) {
  try {
    $me = Invoke-RestMethod -Uri "https://discord.com/api/v10/users/@me" -Headers @{ Authorization = "Bot $token" }
    return $me.id -eq $AppId
  } catch { return $false }
}

function Save-BotToken {
  $secure = Read-Host "Bot Token (Developer Portal > Bot)" -AsSecureString
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)).Trim()
  if (-not (Test-BotToken $plain)) { throw "Discord rejected this token or it belongs to another app" }
  New-Item -ItemType Directory -Force (Split-Path $TokenFile) | Out-Null
  ConvertTo-SecureString $plain -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -Path $TokenFile -Encoding ascii
  Write-Host "Token saved (DPAPI, this Windows user only): $TokenFile"
  return $plain
}

function Use-BotToken {
  if (Test-Path $TokenFile) {
    $secure = Get-Content $TokenFile | ConvertTo-SecureString
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
    if (Test-BotToken $plain) { $env:DISCORD_TOKEN = $plain; return }
    Write-Host "Saved token no longer works (was it reset?). Enter the new one."
  }
  $env:DISCORD_TOKEN = Save-BotToken
}

if ($MyInvocation.InvocationName -ne ".") {
  if ($Reset -and (Test-Path $TokenFile)) { Remove-Item $TokenFile }
  Use-BotToken
  Remove-Item Env:DISCORD_TOKEN -ErrorAction SilentlyContinue
}
