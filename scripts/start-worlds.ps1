$ErrorActionPreference = 'Stop'
$worldsRoot = Split-Path -Parent $PSScriptRoot
$worldsLogs = Join-Path $worldsRoot 'work'
New-Item -ItemType Directory -Path $worldsLogs -Force | Out-Null
$worldsServer = Start-Process -FilePath (Get-Command node).Source -ArgumentList 'server/index.js' -WorkingDirectory $worldsRoot -WindowStyle Hidden -Environment @{ TRUST_PROXY = '1' } -RedirectStandardOutput (Join-Path $worldsLogs 'worlds-server.out.log') -RedirectStandardError (Join-Path $worldsLogs 'worlds-server.err.log') -PassThru
Set-Content -LiteralPath (Join-Path $worldsLogs 'worlds-server.pid') -Value $worldsServer.Id -Encoding ascii
Write-Output "Worlds server started: PID $($worldsServer.Id), http://127.0.0.1:3001"
