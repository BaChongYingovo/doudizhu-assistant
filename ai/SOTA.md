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

## 4. 还没做的（浏览器侧）

插件是纯前端包，`sota` 要在 DSH 里生效还需要：

1. `onnxruntime-web`（wasm 后端约 8–15 MB）——`client.js` 现在是 144 KB，直接内联会失控，
   需要按需从 CDN/本地资源加载。
2. 放到 Web Worker 里跑，主线程不能阻塞（用户要求 sota 允许 4s 且必须有等待反馈）。
3. 权重按需下载 + sha256 校验 + 失败降级 `pro9999` 并提示。

这三步是独立的 UI/运行时改造，用户已要求先出可装的 L1 PR、L2 单独 PR，所以本文件只覆盖
Node 侧接入与强度证据。
