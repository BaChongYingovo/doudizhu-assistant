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

# 端口没释放就起新进程，健康检查会命中旧进程 → A/B 结果串味。必须等到真正没人监听。
function Wait-PortFree([int]$port, [int]$timeoutMs) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($sw.ElapsedMilliseconds -lt $timeoutMs) {
    $c = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if (-not $c) { return $true }
    Start-Sleep -Milliseconds 120
  }
  return $false
}

# 期望的引擎指纹：与 tools/engine.cjs 里 __sha 的算法一致（文件字节的 sha256 前 12 位）
function Get-EngineSha([string]$file) {
  if (-not (Test-Path $file)) { return $null }
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $bytes = [System.IO.File]::ReadAllBytes($file)
  $hash = $sha.ComputeHash($bytes)
  return (($hash | ForEach-Object { $_.ToString('x2') }) -join '').Substring(0, 12)
}

foreach ($name in $List.Split(",")) {
  $engine = $null
  if ($name -ne "current") { $engine = Join-Path $env:TEMP ("engine-" + $name + ".js") }
  $target = if ($engine) { $engine } else { Join-Path $root "plugin\dsh-doudizhu-game\src\engine.js" }
  $want = Get-EngineSha $target
  if (-not $want) { "FAIL missing engine $target" | Out-File -FilePath $log -Encoding UTF8 -Append; continue }
  Kill-Bridge
  if (-not (Wait-PortFree 8791 8000)) { "FAIL port 8791 busy" | Out-File -FilePath $log -Encoding UTF8 -Append; continue }
  if ($engine) { $env:DDZ_ENGINE = $engine } else { Remove-Item Env:\DDZ_ENGINE -ErrorAction SilentlyContinue }
  $bp = Start-Process -FilePath "node" -ArgumentList "tools\bridge.mjs", "8791" -PassThru -WindowStyle Hidden
  $ok = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 250
    $h = curl.exe -s --max-time 2 http://127.0.0.1:8791/health 2>$null
    if ($h -and $h -match "ok" -and $h -match $want) { $ok = $true; break }
    if ($bp.HasExited) { break }
  }
  if (-not $ok) {
    "FAIL start $name (want sha $want)" | Out-File -FilePath $log -Encoding UTF8 -Append
    if (-not $bp.HasExited) { Stop-Process -Id $bp.Id -Force -ErrorAction SilentlyContinue }
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
