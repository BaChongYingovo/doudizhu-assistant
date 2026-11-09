# 对 DouZero WP 打强度基准（而不是对 min 贪心）。
#
# 用法：
#   powershell -ExecutionPolicy Bypass -File tools\bench-vs-douzero.ps1
#   powershell -ExecutionPolicy Bypass -File tools\bench-vs-douzero.ps1 -Games 300 -Tier go
#
# 说明：
# - 8801 跑本引擎（被评测方），8802 跑同一份 bridge 但设 DZ_SOTA_FARMER=1，让三个座位都用 DouZero。
# - 因为 arena.py 只接受一个 --port，这里用 --opp-port 指向对手桥。
# - PYTHONHASHSEED=0 是必需的：min 对手与 legal_actions 顺序都受它影响。

param(
  [int]$Games = 300,
  [string]$Tier = 'go',
  [int]$Seed = 1,
  [int]$OurPort = 8801,
  [int]$OppPort = 8802
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root
$env:PYTHONHASHSEED = '0'

function Wait-PortFree([int]$port) {
  for ($i = 0; $i -lt 20; $i++) {
    $c = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if (-not $c) { return $true }
    Start-Sleep -Milliseconds 250
  }
  return $false
}

function Start-Bridge([int]$port, [string]$farmerFlag) {
  if (-not (Wait-PortFree $port)) { throw "端口 $port 一直被占用" }
  if ($farmerFlag) { $env:DZ_SOTA_FARMER = '1' } else { Remove-Item Env:DZ_SOTA_FARMER -ErrorAction SilentlyContinue }
  Start-Process -FilePath node -ArgumentList 'tools/bridge.mjs', $port -WindowStyle Hidden
  Start-Sleep -Seconds 3
  $h = Invoke-RestMethod -Uri "http://127.0.0.1:$port/health" -TimeoutSec 10
  Write-Host ("bridge {0} sha={1} sota={2}" -f $port, $h.sha, $h.sota)
}

foreach ($p in @($OurPort, $OppPort)) {
  $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
  if ($c) { Stop-Process -Id $c.OwningProcess -Force }
}
Start-Sleep -Seconds 2

Start-Bridge $OurPort $false
Start-Bridge $OppPort $true

foreach ($seat in @(0, 1)) {
  $role = if ($seat -eq 0) { 'landlord' } else { 'farmer' }
  $out = "arena\result-vs-douzero-$role-$Tier.json"
  Write-Host ("=== vs DouZero: our {0} (tier={1}, {2} games) ===" -f $role, $Tier, $Games)
  python arena\arena.py --games $Games --seat $seat --opp bridge --opp-tier sota `
    --tier $Tier --seed $Seed --port $OurPort --opp-port $OppPort --out $out --quiet
}

Write-Host 'done. 结果 JSON 在 arena\result-vs-douzero-*.json'