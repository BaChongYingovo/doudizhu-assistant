# SOTA 档（DouZero WP）——Node 侧接入与实测

第 8 档 `sota` 的推理链路、编码器与评测结论。权重不入仓，按 `ai/models/MANIFEST.json` 下载。

## 1. 做了什么

| 文件 | 作用 |
|---|---|
| `ai/douzero.mjs` | DouZero 编码器（`cards2array` / `encodeZ` / `encodeBase`）+ `DouZeroPolicy`（onnxruntime-node 批量打分） |
| `ai/test-encoder.mjs` | 逐维对齐测试：5 组手牌、810 维 z、319 维地主 x、430 维农民 x |
| `ai/validate-encoder.py` | 独立实现（不 import douzero）生成 `ai/golden-encoder.json` |
| `tools/bridge.mjs` | `/move` 支持 `tier:"sota"`；`/health` 多返回 `sota:true` |
| `arena/arena.py` | `--tier` 可选 `sota` |

编码规则与 DouZero `env.py` 对齐：

- 牌值：本引擎 3..15 / 16(小王) / 17(大王) → DouZero 3..14 / 17(2) / 20 / 30
- 54 维：4×13 牌面矩阵按列展平 + 2 维大小王
- `z`：最近 15 手，每 3 手拼成 162 维 → `[batch, 5, 162]`
- `x`：地主 319 + 54 = 373 维；农民 430 + 54 = 484 维（顺序照 `_get_obs_landlord*` 的 hstack）

`ai/test-encoder.mjs` 的 8 项断言全部与 Python 黄金向量一致，说明编码器不是"看起来对"，是逐维对。

## 2. 实测（500/300 副，seed=1，`PYTHONHASHSEED=0`）

| 对局 | 本引擎启发式 | sota（DouZero） |
|---|---|---|
| 地主 vs 两个「出最少」贪心（500 副） | 0.946 | **0.972** |
| 地主 vs 本引擎 plus 档（300 副） | 0.613 | **0.697** |
| 农民 vs 两个贪心（500 副） | **0.898** | 0.800 |
| 农民 vs 本引擎 plus 档（300 副） | **0.560** | 0.443 |

- 地主位：DouZero 明显更强（对 plus 档 +8.3 个百分点）。
- 农民位：DouZero **反而更弱**，两种对手下都低于启发式。把 `landlord_up` / `landlord_down`
  模型对调后重测（0.417 vs 0.443）说明不是位置映射问题，而是 DouZero 的农民模型依赖
  同水平队友的配合信号；本引擎的农民在弱队友下更稳。
- 因此 `sota` 档按位置分流：**地主走 DouZero，农民回退 `go` 档启发式**
  （`DZ_SOTA_FARMER=1` 可强制农民也走 DouZero，仅供实验）。

## 3. 耗时与体积

- 单次决策（含批量编码 + 一次前向）：均值 2.7–3.4 ms；`onnxruntime-node` 冷启动约 0.3 s。
- 权重：`landlord.onnx` 5,834,135 B、`landlord_up` / `landlord_down` 各 6,061,463 B，合计 17,956,061 B。
- Node 依赖 `onnxruntime-node@1.31.1` 解包后约 295 MiB（仅评测用，不进插件包）。

## 4. 浏览器侧（已接入，2026-11-09）

原计划的 `onnxruntime-web` 方案被否掉了：DouZero 的图只有「一个 LSTM + 六层全连接」
（`research/dist/DouZero-main/douzero/dmc/models.py`），权重本来就是 float32，
自己解析 ONNX initializer + 手写前向就够，省下 8–15 MB 的 wasm 运行时，也不需要 CDN。

插件里的实现：`plugin/dsh-doudizhu-game/src/sota.js`

1. **不用 onnxruntime-web**：自带 protobuf 解析器读 initializer（15 个张量），
   LSTM 按 4 门手写（`i/f/g/o` 顺序与 ONNX 一致），再接 6 层 `Gemm+ReLU`。
   数值对齐 `onnxruntime-node` 的结果：逐动作分值最大误差 < 1e-4，`argmax` 5/5 全一致
   （`plugin/dsh-doudizhu-game/test/sota.test.mjs`，独立复算脚本 `ai/validate-js-infer.mjs`）。
2. **不阻塞主线程**：整次前向（含编码 + 全部候选打分）实测 15.3 ms（Node v24, 20 副对局
   183 次决策），远低于 `pro9999` 的 4 s 上限，所以没上 Worker——真上了反而多一层消息开销。
3. **权重按需下载**：清单仍然照抄 `ai/models/MANIFEST.json`（体积 + sha256），
   先试 `huggingface.co`，失败自动切 `hf-mirror.com`（本机实测直连 HF 超时、镜像可用且
   返回的最终 CDN 带 `access-control-allow-origin`）。校验不过一律拒绝加载；
   失败会降级到 `go` 档启发式并在建议卡里写明原因，不会卡住对局。
4. **农民位仍然回退启发式**：与 Node 侧结论一致，插件 `engine.js` 里 `setSotaFarmer(true)`
   才能强制（默认关）。

想复现强度：`node plugin/dsh-doudizhu-game/tools/arena-sota.mjs --a sota --b go --farmer plus --games 100`；
只看速度：`node plugin/dsh-doudizhu-game/tools/bench-sota.mjs 20`；
真浏览器实测（Headless Chrome 走真实网络下载 + 缓存 + 前向 + 引擎建议）：
`node plugin/dsh-doudizhu-game/tools/browser-sota-check.mjs`。

实测数字（Chrome，冷缓存）：

| 环节 | 结果 |
|---|---|
| 下载 5,834,135 B + sha256 校验 | 2.8 s，源 `huggingface.co`（浏览器侧可达，Node curl 直连会超时） |
| ONNX 解析 + 首次前向（56 个候选） | 51.9 ms |
| 引擎 `advise()` 整次（含 sotaCtx 还原 + 候选生成） | 59.4 ms |
| 结果 | `tier: sota`、`fallback: false`、理由「（sota 档）DouZero WP 选「单张 9」」 |

## 5. 强度复核（插件内，同发牌成对）

`tools/arena-sota.mjs`，农民固定 `plus`，A/B 用同一批发牌各打一遍：

| 地主档位 | 300 副胜率（seed=7） |
|---|---|
| `sota` | **0.740** |
| `go` | 0.630 |

差值 +0.110，与上面 §2 的 Node 侧（0.697 vs 0.613）方向一致、量级相符；
说明插件里的 `sotaCtx` 还原与 `bridge.mjs` 那套等价，没在搬运中失真。



## 6. 对 DouZero 当对手（500 副，2026-11-09 补测）

前面的对照用的都是本引擎或贪心。更硬的问法是：**让 DouZero 当对手，sota 档能打成什么样。**

| 我方 | 对手 | 样本 | 胜率 | illegal |
|---|---|---|---|---|
| `sota` 地主 | 两个 DouZero 农民 | 500 | **0.674** | 0 |
| `sota` 农民（回退 `go`） | DouZero 地主 + DouZero 队友 | 500 | **0.402** | 0 |
| `go` 农民（对照） | 同上 | 500 | 0.402 | 0 |
| `go` 地主（对照） | 两个 DouZero 农民 | 500 | 0.586 | 0 |
| `pro200` 地主（对照） | 两个 DouZero 农民 | 200 | 0.540 | 0 |
| DouZero 地主 vs DouZero 农民（对称性） | — | 100 | 0.620 | 0 |

- 地主位：0.674，同条件 `go` 0.586、`pro200` 0.540 —— 比启发式高 8.8 个点、比 MC 高 13 个点，**模型确实更强**。
- 农民位：回退后与 `go` 完全一致（0.402 = 0.402），确认回退是同一套决策、没有打折。
- 对称性 0.620 说明这个环境里地主位本身占优，0.674 / 0.402 不能读成"我方地主强、农民弱"。

完整口径、复现命令与踩坑记录见 `docs/sota-bench.md`。
