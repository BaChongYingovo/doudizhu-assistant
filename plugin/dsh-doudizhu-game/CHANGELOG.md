# 更新记录

## 2026-11-09 — 出牌逻辑强化（L1）

### 修复

- **出牌生成与牌型识别对齐 rlcard 权威动作空间**（`plugin/dsh-doudizhu-game/src/engine.js`）
  - `comboRanks` 不再按 `max(count, limit)` 截断候选池，改为全量枚举（上限 4096 组）
  - 新增 `wingRanks`：三带一/飞机带单的翅膀允许同点数重复（每点最多 3 张）
  - 四带二不再接受大小王同时作翅膀；飞机翅膀同点数上限 3；与飞机主体相邻的点数不能整段三张（2 除外）
  - 结果：对 27,471 条权威动作，漏解 0、多出 0、`classify` 判 null 0（此前漏解 8,849 处、误判 2,832 条）
- **跟牌拆牌惩罚**（同文件）：单牌/对子跟牌时，若该点数手里还有更多张，按拆散张数扣分（系数 5.5）
- **Monte Carlo 采样不再凭空补牌**：`sampleHands` 改为 54 张守恒，明牌/已知手牌照抄并从牌池扣除
- **`greedyPick` 三个 mode 产生真实差异**，`planCount` 仍只用 mode 0（三者取最小会让手数系统性偏低）
- **兜底出牌**：非法/过牌/拆炸弹建议一律回退到合法最小手

### 新增

- 第 8 档难度 `sota` 的 Node 侧实现（`ai/`，DouZero WP ONNX），详见 `ai/SOTA.md`
- 竞技场判定确定性修复：`arena/arena.py` 的 min 对手按 `(张数, 动作 id)` 排序、`ab-run.ps1` 固定 `PYTHONHASHSEED=0`
- 防串引擎校验：`engine.cjs` 暴露 `__sha`，`bridge.mjs` 的 `/health` 返回引擎指纹，`ab-run.ps1` 启动后必须匹配
- 测试：`movegen` 45 条、`advise-heuristic` 18 条、`sample-hands` 10 条、`bid-strength` 13 条、`fallback-move` 15 条
- 文档：`docs/logic-bench.md`（500 副矩阵 + 消融）、`ai/SOTA.md`、`ai/THIRD_PARTY.md`

### 强度变化（500 副，seed=1，`PYTHONHASHSEED=0`，对手为「出最少」贪心）

| 座位 | 改前 | 改后 |
|---|---|---|
| 地主 | 0.936 | **0.946** |
| 农民 | 0.890 | **0.898** |

自对弈（opp=bridge）两侧均贴近 0.5，属正常。

### 已知弱点

无显式记牌、无残局精算、农民配合仍是硬规则、Plus 以上靠 Monte Carlo 推演、`sota` 目前只在 Node 侧可用。
