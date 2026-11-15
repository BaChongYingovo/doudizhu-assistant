# sota 档强度评测（对 DouZero WP）

第 8 档 `sota` 不再用蒙特卡洛，而是直接跑 DouZero 的 WP 权重。这份文档回答一个问题：
**它到底比原来的 `go` / `pro200` 强多少，在哪个位置上强。**

所有数字都是竞技场实跑产物，JSON 在 `arena/result-vs-douzero-*.json`。

## 1. 口径与环境

| 项 | 值 |
|---|---|
| 引擎 | `plugin/dsh-doudizhu-game/src/engine.js`，sha12 `8f892ea039ef` |
| 对手 | 同一份 `tools/bridge.mjs`，但 `DZ_SOTA_FARMER=1`，三个座位都由 DouZero 决策 |
| 权重 | `ai/models/douzero_WP/landlord.onnx`，sha256 `5ba2f1bb…6d32`（5,834,135 B） |
| 裁判 | rlcard `DoudizhuEnv`（`arena/arena.py`） |
| 随机性 | `PYTHONHASHSEED=0`，`--seed 1`；同一引擎同种子连跑两次逐局 diff = 0 |
| seat | 0 = 我方地主；1 = 我方两个农民（同赢同输） |
| Node | v24.22.1 |

## 2. 结果

### 2.1 主表（500 副）

| 我方 | 对手 | 样本 | 胜率 | illegal | avg_decision_ms |
|---|---|---|---|---|---|
| `sota` 地主 | 两个 DouZero 农民 | 500 | **0.674** | 0 | 2.79 |
| `sota` 农民（回退 `go`） | DouZero 地主 + DouZero 队友 | 500 | **0.402** | 0 | 2.91 |
| `go` 农民（对照，同上条件） | 同上 | 500 | 0.402 | 0 | 1.6 |

农民位两行完全一致，说明"回退 `go`"是**真的回退到同一套决策**，不是打折版。

### 2.2 对照（不同样本量，只做量级比较）

| 我方 | 对手 | 样本 | 胜率 | 备注 |
|---|---|---|---|---|
| `go` 地主 | 两个 DouZero 农民 | 500 | 0.586 | 启发式打模型，与 sota 同条件 |
| `pro200` 地主 | 两个 DouZero 农民 | 200 | 0.540 | 蒙特卡洛打模型 |
| DouZero 地主 vs DouZero 农民 | — | 100 | 0.620 | 对称性检查，不是我方 |

`sota` 地主 0.674（500 副）与对称性检查 0.620（100 副）同量级，说明"我方 sota 地主 ≈ DouZero 地主"，
不是接线错误带来的虚高。

### 2.3 档位之间

| 对局 | 结果 |
|---|---|
| `sota` vs `go`（农民位都用 `plus`，300 副同一批种子） | sota 222/300 = **0.74**；go 189/300 = 0.63 |
| `sota` vs 本引擎 `plus`（300 副） | sota 0.6967；启发式 0.6133 |

## 3. 结论

1. **地主位：sota 明显更强。** 对 DouZero 农民 0.674，同条件 `go` 0.586、`pro200` 0.540；
   500 副同口径下比启发式高 **8.8 个点**，比 MC 高 13 个点。这是本次改造真正的强度增量。
2. **农民位：模型更弱，必须回退。** DouZero 农民模型是和 DouZero 队友一起训的，
   配上本引擎启发式队友只有 0.402（对 go 的 0.402 完全持平），
   而把 up/down 对调重测也只有 0.4167（300 副）——**不是位置映射错，是配合问题**。
3. **所以 sota 档按位置分流**：地主走 DouZero，农民回退 `go`，并在 reason 里写明原因。
   `DZ_SOTA_FARMER=1` 可以强制农民也走模型（只用于实验）。
4. **地主位有先天优势**：DouZero 自己的地主模型打农民模型能到 0.620，所以 0.674 / 0.402
   不能读成"我方地主强、农民弱"，只能读成"地主位强"。

## 4. 复现

```bash
cd doudizhu
# 一次跑完地主 + 农民（脚本内部起 8801 / 8802 两个 bridge）
powershell -ExecutionPolicy Bypass -File tools/bench-vs-douzero.ps1 -Games 500 -Tier sota
```

只跑单个座位：

```bash
$env:PYTHONHASHSEED='0'
python arena/arena.py --games 500 --seat 1 --opp bridge --opp-tier sota `
  --tier sota --seed 1 --port 8801 --opp-port 8802 `
  --out arena/result-vs-douzero-farmer-sota.json
```

## 5. 坑与局限

**坑 1：`DZ_SOTA_FARMER` 会污染被评测方。** 早期脚本用 `$env:DZ_SOTA_FARMER='1'` 再起两个 bridge，
两个进程都继承了这个变量，我方农民位也去用了 DouZero 农民模型，测出 0.326 这种假数字。
现在 `tools/bench-vs-douzero.ps1` 用 `cmd /c "set DZ_SOTA_FARMER=1&& node tools/bridge.mjs 8802"`
只给对手进程。

**坑 2：残留 bridge。** 直接调 `arena.py` 时如果 8801 还是上一轮带错环境变量的进程，
结果会莫名其妙。跑之前先确认端口无人监听，或统一用脚本（脚本会杀端口占用者）。

局限：

- 只测了 DouZero 的 WP 变体；ADP / SL 权重在镜像里也有，未跑。
- 对手的观测由 `tools/bridge.mjs` 从 trace 重建，若 trace 里 pass 记录与真实序列有偏差，
  对手强度会被低估。交叉验证：sota 对 plus 档 0.6967 与对 DouZero 0.674 方向一致，量级可信。
- PerfectDou 的编码器依赖 Linux 预编译 `.so`，Windows 下无法当对手，这一强基线暂缺。
- 农民位结论建立在"队友是本引擎启发式"的前提下；如果队友也是模型，结论可能不同。
