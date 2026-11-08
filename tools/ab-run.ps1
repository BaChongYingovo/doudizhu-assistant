param([string]$List = "v3", [int]$Games = 200, [int]$Seat = 0, [string]$Opp = "min", [int]$Seed = 1)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$log = Join-Path $env:TEMP "ddz-ab-log.txt"
"=== run $(Get-Date -Format o) ===" | Out-File -FilePath $log -Encoding UTF8 -Append

function Kill-Bridge {
  $conns = Get-NetTCPConnection -LocalPort 8791 -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conns) {
    if ($c.OwningProcess -gt 0) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue }
  }
}

foreach ($name in $List.Split(",")) {
  $engine = $null
  if ($name -ne "current") { $engine = Join-Path $env:TEMP ("engine-" + $name + ".js") }
  Kill-Bridge
  Start-Sleep -Milliseconds 400
  if ($engine) { $env:DDZ_ENGINE = $engine } else { Remove-Item Env:\DDZ_ENGINE -ErrorAction SilentlyContinue }
  $bp = Start-Process -FilePath "node" -ArgumentList "tools\bridge.mjs", "8791" -PassThru -WindowStyle Hidden
  $ok = $false
  for ($i = 0; $i -lt 25; $i++) {
    Start-Sleep -Milliseconds 400
    $h = curl.exe -s --max-time 2 http://127.0.0.1:8791/health 2>$null
    if ($h -and $h -match "ok") { $ok = $true; break }
    if ($bp.HasExited) { break }
  }
  if (-not $ok) {
    "FAIL start $name" | Out-File -FilePath $log -Encoding UTF8 -Append
    continue
  }
  $out = "arena\result-ab-$name.json"
  if (Test-Path $out) { Remove-Item $out -Force }
  python arena\arena.py --games $Games --seat $Seat --opp $Opp --tier go --seed $Seed --out $out | Out-Null
  try { Stop-Process -Id $bp.Id -Force -ErrorAction SilentlyContinue } catch {}
  if (Test-Path $out) {
    $s = (Get-Content $out -Raw -Encoding UTF8 | ConvertFrom-Json).summary
    "$name : $($s.wins)/$($s.games) = $($s.win_rate) illegal=$($s.illegal_fallbacks) ms=$($s.avg_decision_ms)" |
      Out-File -FilePath $log -Encoding UTF8 -Append
  } else {
    "FAIL arena $name" | Out-File -FilePath $log -Encoding UTF8 -Append
  }
}
Kill-Bridge
"=== done ===" | Out-File -FilePath $log -Encoding UTF8 -Append
