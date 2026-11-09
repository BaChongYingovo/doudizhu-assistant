# 难度阶梯实测：每个档位单独对 DouZero WP 当对手（我方地主位）。
#
# 用法：
#   powershell -ExecutionPolicy Bypass -File tools\bench-ladder.ps1
#   powershell -ExecutionPolicy Bypass -File tools\bench-ladder.ps1 -Tiers "free,go,plus" -Games 100
#
# 为什么只跑地主位：农民位受队友影响，会把「模型强弱」和「配合好坏」混在一起；
# 地主位是单人对单人，最适合给难度分档排序。
#
# 高挡位很慢（pro9999 一手最多 4 秒），所以默认按档位给不同样本量。

param(
  [string]$Tiers = '',
  [int]$Seed = 1
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root
$env:PYTHONHASHSEED = '0'
$env:PYTHONDONTWRITEBYTECODE = '1'

# 档位 -> 样本量。低档快，多跑；高档慢，少跑但只看量级。
$plan = [ordered]@{
  free = 200
  go   = 200
  plus = 200
  pro  = 150
  max  = 60
}
if ($Tiers) {
  $want = $Tiers -split ','
  $plan = [ordered]@{}
  foreach ($t in $want) { $t = $t.Trim(); if ($t) { $plan[$t] = $(if ($t -match '^pro(500|9999)$') { 20 } else { 200 }) } }
}

function Wait-PortFree([int]$port) {
  for ($i = 0; $i -lt 20; $i++) {
    $c = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if (-not $c) { return $true }
    Start-Sleep -Milliseconds 250
  }
  return $false
}

function Start-Bridge([int]$port, [bool]$farmerFlag) {
  if (-not (Wait-PortFree $port)) { throw "端口 $port 一直被占用" }
  $prefix = if ($farmerFlag) { 'set DZ_SOTA_FARMER=1&& ' } else { '' }
  Start-Process -FilePath cmd -ArgumentList '/c', ($prefix + "node tools/bridge.mjs $port") -WindowStyle Hidden
  Start-Sleep -Seconds 3
  $h = Invoke-RestMethod -Uri "http://127.0.0.1:$port/health" -TimeoutSec 10
  Write-Host ("bridge {0} sha={1} sota={2}" -f $port, $h.sha, $h.sota)
}

foreach ($p in @(8801, 8802)) {
  $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
  if ($c) { Stop-Process -Id $c.OwningProcess -Force }
}
Start-Sleep -Seconds 2

Start-Bridge 8801 $false
Start-Bridge 8802 $true

$rows = @()
foreach ($tier in $plan.Keys) {
  $games = $plan[$tier]
  $out = "arena\result-ladder-$tier.json"
  Write-Host ("=== {0} vs DouZero WP, {1} games ===" -f $tier, $games)
  python arena\arena.py --games $games --seat 0 --opp bridge --opp-tier sota `
    --tier $tier --seed $Seed --port 8801 --opp-port 8802 --out $out --quiet
  $j = Get-Content $out -Encoding UTF8 -Raw | ConvertFrom-Json
  $rows += [pscustomobject]@{
    tier  = $tier
    games = $j.summary.games
    win   = [math]::Round($j.summary.win_rate, 3)
    ms    = [math]::Round($j.summary.avg_decision_ms, 2)
    ill   = $j.summary.illegal_fallbacks
  }
}

Write-Host ''
Write-Host 'tier    games  win_rate  avg_ms  illegal'
foreach ($r in $rows) {
  Write-Host ("{0,-7} {1,5}  {2,8}  {3,6}  {4}" -f $r.tier, $r.games, $r.win, $r.ms, $r.ill)
}

foreach ($p in @(8801, 8802)) {
  $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
  if ($c) { Stop-Process -Id $c.OwningProcess -Force }
}
