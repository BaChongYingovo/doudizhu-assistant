# 斗地主引擎逻辑基准（500 副矩阵 + 消融）

> 生成时间：2026-11-09（Asia/Shanghai）
> 执行者：exec-verify（team ddz-logic / t13）
> 本文档只记录命令与产物数字，不改 engine.js / game.js / ui.js。所有 ab-run 均由 `tools/ab-run.ps1` 的 `/health` 引擎指纹校验把关；看到 `FAIL start ... (want sha ...)` 一律记录、不绕过脚本。

---

## 1. 口径说明

- `seat=0` 是**地主**，`seat=1` 是**我方农民阵营**（seat 1 由被测引擎决策，seat 2 同阵营、两个农民同赢同输）。
- **胜率 = 我方阵营拿下这一局的比例**（`arena.py` 以 `payoffs[seat] > 0` 计胜）；地主 / 农民各自独立跑 500 副，**不混算**。每局用 `--seed 1` 独立随机，tier 固定 `go`。
- `opp=min` 是「每次出牌数最少的贪心」基线：合法动作里挑牌数最少的一手，能出就出。
- `opp=bridge` 是**对手也走同一个 HTTP 桥 / 同一个引擎**（`arena.py` 的 `our_action`），即自我对弈。
- `illegal_fallbacks`（非法兜底）= 引擎建议不在合法动作集里、桥报错等导致该步改用随机动作的次数。
- `avg_decision_ms`（平均决策 ms）= `1000 * 总耗时 / 总步数`（含对手步与 env 步进，非纯引擎耗时，只作同机型横向参考）。
- **判定确定性**：`0f4125b` 起 `arena.py` 对 min 对手按 `(张数, 牌面字符串)` 取最小、`find_action` 按 id 排序，`tools/ab-run.ps1` 固定 `PYTHONHASHSEED=0`；同引擎同 seed 重跑逐局 diff=0（详见 §6）。此前同引擎 500 副能差 31 局，是 bug 不是噪声。
- **门禁看 500 副，不看 200 副**：200 副样本量小；确定性修复前 200/500 副重跑有 ±1~2 点甚至更大的伪抖动，不作验收依据。

---

## 2. 环境与指纹

| 角色 | 来源 | sha256 前 12 位 | 说明 |
|---|---|---|---|
| `base` | `$env:TEMP\engine-base.js`，逐字节取自 `main` (`c61600b`) 的 `plugin/dsh-doudizhu-game/src/engine.js` | `e45178236455` | 与仓库内 `tools/engine.baseline.js` 字节完全相同（已用 Get-FileHash 核对）；main 分支旧引擎 |
| `v9` | `$env:TEMP\engine-v9.js`，取自 `8c9560c` | `07bf40f2aa65` | 旧启发式 + 新 movegen/classify（只换出牌生成与牌型识别） |
| `v15` | `$env:TEMP\engine-v15.js`，取自 `080731f` | `b28d431238f7` | v9 + 跟牌拆牌罚 `s -= (same - bulk) * 5.5` |
| `current` | 工作树 `plugin/dsh-doudizhu-game/src/engine.js` | **`fca77dcfc89b`** | 版本标签 = `0f4125b`（含 `43e04c9` greedyPick 三 mode + `0f4125b` 的 planCount[0] 与竞技场确定性修复）；独立复跑时 HEAD 已到 `4939162`（`e409560` 补测试与 client.js、`4939162` 只改 README，engine.js 字节始终未变，sha12 仍 `fca77dcfc89b`） |

补充事实与注意点：

- **base = `e45178236455`、current 版本 = `0f4125b`**（队长 09:12 口径）。`0f4125b` 提交说明写明：`arena.py` 固定 min 对手排序 + `find_action` 排序 + `PYTHONHASHSEED=0`，`engine.js` 的 `planCount` 改回 `greedyPlans(c, [0])`（三 mode 取最小手数会让手数系统性偏低，实测 arena landlord 500 副 −14 局），`greedyPlans` 默认仍取三 mode 最小值供测试 / SOTA 用。
- 血缘已用 `git diff` 逐段核对：`main → 8c9560c` 只改 movegen/classify；`8c9560c → 080731f` 只加 5.5 拆牌罚；`080731f → ee824e0` 只有 `sampleHands` 守恒修复 + `knownHands`；`43e04c9` 补 greedyPick 三个 mode 的真实差异；`0f4125b` 再改 planCount[0] + 竞技场确定性；`e409560` 只补 `plugin/dsh-doudizhu-game/test/sample-hands.test.mjs` 的确定性向量并重建 client.js。三个 TEMP 快照均用 `git hash-object` 与目标 commit 的 blob 逐字节校验通过。
- `tools/engine.cjs` 从**工作树**读 `src/engine.js` 并导出 `__sha`（文件字节 sha256 前 12 位），`/health` 返回它；`tools/ab-run.ps1` 先 `Kill-Bridge` + `Wait-PortFree(8791, 8000)`，再要求 `/health` 同时含 `ok` 与期望 sha，否则写 `FAIL start <name> (want sha <sha>)` 并跳过该引擎。日志本身不记 sha，故每节标题标 `current @ fca77dcfc89b`。
- 确定性修复（`0f4125b`）之前的全部 `current` / `base` 数字，一律标「修复前，作废」，不进入正式门禁行。
- `greedyPick` mode 0 与旧实现逐字一致；`greedyPlans` 默认取三 mode 最小手数（`plugin/dsh-doudizhu-game/test/sample-hands.test.mjs` 有断言），但**决策用的 `planCount` 显式传 `[0]`**，只用 mode 0，原因见上。文档与当前代码以此为准。
- **复跑时的精确环境**：5 组 ab-run 分两段完成 —— `RERUN2` 09:28:52 起只跑完 min seat0 即因外层端口守卫误判被 kill（该轮 ab-run 自身已 `=== done ===`，数字有效）；`RERUN3` 09:37:56–09:55:12 顺序跑完余下 4 组（min seat1 / bridge seat0 / bridge seat1 / 消融 seat1），起止日志均记 `current_sha12=fca77dcfc89b`、`HEAD=4939162`（`docs(readme): 竞技场基线换成确定性口径 + 补「强度目标与已知弱点」`）。`engine.js` sha12 始终 `fca77dcfc89b`，`git diff 0f4125b -- plugin/dsh-doudizhu-game/src/engine.js` 为空（本次基准的被测引擎字节与 `0f4125b` 完全一致）。当时工作树另有他人未提交改动：`M README.md`、`M arena/arena.py`（`--tier` 增加 `sota` choice）、`M tools/bridge.mjs`（新增 DouZero SOTA 分支 + `/health` 多返回 `sota:true`），以及未跟踪 `ai/`。本基准固定 `--tier go`：bridge 的 `decide()` 原路径逐字未动（`tools/bridge.mjs:32-69`），SOTA 分支只在 `body.tier === 'sota'` 时经动态 `import('../ai/douzero.mjs')` 进入；`/health` 仅多一个字段，不影响 `ok` + sha 校验。arena.py 的 go/min 排序逻辑（`arena/arena.py:45-50, 109-115`）未变。故这些并行改动不进入本基准的 go 档结果。
- 快照前期事故：`$env:TEMP` 里三个 `engine-*.js` 曾全部缺失，08:51:13 的日志出现过 `FAIL missing engine ...\engine-base.js`。补齐后重跑；该 FAIL 保留在 §6。旧日志已备份至 `%TEMP%\ddz-ab-log.before-t13.txt`。

---

## 3. 500 副矩阵（base vs current × landlord/farmer × min/bridge）

命令（工作目录 `doudizhu`，每条 `-Games 500 -Seed 1`）：

```
.\tools\ab-run.ps1 -List "base,current" -Games 500 -Seat 0            # opp=min, landlord
.\tools\ab-run.ps1 -List "base,current" -Games 500 -Seat 1            # opp=min, farmer
.\tools\ab-run.ps1 -List "base,current" -Games 500 -Seat 0 -Opp bridge # bridge, landlord
.\tools\ab-run.ps1 -List "base,current" -Games 500 -Seat 1 -Opp bridge # bridge, farmer
```

> 状态：以下数值由 exec-verify 在确定性修复后**独立复跑**填入（非沿用队长数字）；所有数字与 `%TEMP%\ddz-ab-log.txt` 逐条对得上。日志定位：`RERUN2` 09:28:58 轮（min seat0，该作业 [1/5] 完成后因端口守卫误判被 kill，但此轮 ab-run 已完整写出 `=== done ===`，数字有效）、`RERUN3` 09:38:18 / 09:41:40 / 09:46:09 轮（min seat1、bridge seat0、bridge seat1）。`RERUN3` 起止均记录 `current_sha12=fca77dcfc89b`，`HEAD=4939162`。

| 场景 | 引擎 | 胜/总 | 胜率 | 非法兜底 | 平均决策 ms | current 指纹 |
|---|---|---|---|---|---|---|
| landlord / min | base | 468/500 | 0.936 | 0 | 2.42 | — |
| landlord / min | current | 473/500 | 0.946 | 0 | 2.90 | `fca77dcfc89b` |
| farmer / min | base | 445/500 | 0.890 | 0 | 2.27 | — |
| farmer / min | current | 449/500 | 0.898 | 0 | 2.61 | `fca77dcfc89b` |
| landlord / bridge | base | 266/500 | 0.532 | 0 | 5.63 | — |
| landlord / bridge | current | 261/500 | 0.522 | 0 | 4.69 | `fca77dcfc89b` |
| farmer / bridge | base | 234/500 | 0.468 | 0 | 5.03 | — |
| farmer / bridge | current | 239/500 | 0.478 | 0 | 4.71 | `fca77dcfc89b` |

**min 对手（正式门禁）**：seat 0 `0.946 > 0.936`（+5 局）、seat 1 `0.898 > 0.890`（+4 局），**两条均过门禁**。bridge 对手是自对弈、双方同引擎，胜率天然贴近 0.5：landlord 侧 current 比 base 低 5 局（`0.522` vs `0.532`）、farmer 侧高 5 局（`0.478` vs `0.468`），两侧合起来正好抵消，属自我对弈的对称性表现，**不粉饰成全胜，也不拿它当门禁**（门禁只看 min 对手）。

队长官方数字（`0f4125b` 修复后、确定性口径，min 两条，供对照）：seat 0 = `base 468/500 = 0.936` / `current 473/500 = 0.946`；seat 1 = `base 445/500 = 0.890` / `current 449/500 = 0.898`。**exec-verify 独立复跑的胜局数与胜率与官方完全一致**（`illegal` 与 `ms` 因轮次不同有小差异，如实记录：官方 09:07 轮 `illegal=0 / ms=2.92,2.58,2.50,2.54`，消融 09:15 轮 base `illegal=4`，见 §6 第 7 条）。

历史参考（08:42 旧日志，`opp=min / seat=0 / 500 副`，**确定性修复前，作废，仅留作噪声素材**）：`base 480/500 = 0.96 illegal=0 ms=2.24`、`current 468/500 = 0.936 illegal=0 ms=2.63`。08:59:42 另一轮 `base 449/500 = 0.898` 与 08:42 的 `0.960` 差 6.2 点，根因是 PYTHONHASHSEED 判定不确定（见 §6），**修复前作废**，不用于门禁。

---

## 4. 消融（500 副，base / v9 / v15 / current）

命令：

```
.\tools\ab-run.ps1 -List "base,v9,v15,current" -Games 500 -Seat 0
.\tools\ab-run.ps1 -List "base,v9,v15,current" -Games 500 -Seat 1
```

语义：v9 = 旧启发式 + 新 movegen/classify；v15 = v9 + 拆牌罚 5.5（sampleHands 修复前的主体）；current = v15 + sampleHands 守恒修复 + `43e04c9` greedyPick 三 mode + `0f4125b` 的 planCount[0] 与确定性修复。

> 数据来源：`landlord / min`（seat 0）四行来自队长 09:15–09:18 同一批消融轮（日志 `=== run 2026-11-09T09:15:42.6342198+08:00 ===`），`farmer / min`（seat 1）四行由 exec-verify 独立复跑填入（`RERUN3` 日志 `=== run 2026-11-09T09:50:27.1419172+08:00 ===`），均可与 `%TEMP%\ddz-ab-log.txt` 逐行核对。

| 场景 | 引擎 | 胜/总 | 胜率 | 非法兜底 | 平均决策 ms | 来源 |
|---|---|---|---|---|---|---|
| landlord / min | base | 468/500 | 0.936 | 4 | 2.74 | 队长 09:15 轮 |
| landlord / min | v9 | 472/500 | 0.944 | 0 | 2.45 | 队长 09:16 轮 |
| landlord / min | v15 | 473/500 | 0.946 | 0 | 2.54 | 队长 09:18 轮 |
| landlord / min | current | 473/500 | 0.946 | 0 | 2.56 | 队长 09:18 轮 |
| farmer / min | base | 445/500 | 0.890 | 0 | 1.55 | exec-verify 09:50 轮 |
| farmer / min | v9 | 448/500 | 0.896 | 0 | 1.81 | exec-verify 09:50 轮 |
| farmer / min | v15 | 449/500 | 0.898 | 0 | 2.16 | exec-verify 09:50 轮 |
| farmer / min | current | 449/500 | 0.898 | 0 | 1.73 | exec-verify 09:50 轮 |

**消融结论**：两个座位同向，且 `current` 与 `v15` **完全相同**（seat 0 各 473/500 = 0.946、seat 1 各 449/500 = 0.898），go 档**不存在第三个变量**——`sampleHands` 守恒修复 / `knownHands` / greedyPick 三 mode / planCount[0] / 确定性修复在 `opp=min` 这 500 副里没有改变胜负，符合「go 档应与 v15 完全一致」的预期。

- **掉分/提升的来源拆开看**：seat 0 `base 468 → v9 472`（+4 局）来自 movegen/classify（旧引擎还会产出 `3,3,3,3,16,17` 这类非法动作，`illegal=4`，见 §6 第 7 条），`v9 472 → v15 473`（+1 局）来自拆牌罚 5.5；seat 1 `base 445 → v9 448`（+3 局）同样来自 movegen/classify，`v9 448 → v15 449`（+1 局）来自拆牌罚。即**主要收益来自 movegen/classify，拆牌罚是次要的 +1 局弱信号**；此前 08:42 旧日志里 `base 0.960 > current 0.936` 的「掉 2.4 点」是 `PYTHONHASHSEED` 判定不确定造成的伪现象，确定性修复后不复现（作废历史不参与结论）。
- 增量都在 1σ 附近（500 副 σ≈2.2 局），只能说「方向一致、无回退」，不能把单个 +1 / +4 局夸大成显著强化；结合 §3 的 min 两条门禁，当前结论是**通过门禁但未证明大幅领先**。

### 4.1 单点改动补充消融（队长 09:26 轮，seat 0 / 500 副 / 确定性口径）

队长在 `current` 上做单点改动的对照（每行一个变量），引擎变体文件通过 `-List` 单独命名，日志 `%TEMP%\ddz-ab-log.txt` 中对应 `cur-nopass1 / cur-nopass2 / cur-nopass / cur-break0 / cur-break3`：

| 变体 | 对应日志名 | 胜/总 | 胜率 | 非法兜底 | 平均决策 ms | 说明 |
|---|---|---|---|---|---|---|
| `current`（现状） | `current` | 473/500 | 0.946 | 0 | 2.56 | 基线 |
| 去掉「地主放上家小牌先过一手」 | `cur-nopass1` | 476/500 | 0.952 | 0 | 2.45 | 唯一有正面信号的单点改动 |
| 去掉「只有炸弹能压就过」 | `cur-nopass2` | 474/500 | 0.948 | 0 | 2.42 | 与现状基本持平 |
| 两条都去掉 | `cur-nopass` | 474/500 | 0.948 | 0 | 2.58 | 无叠加收益 |
| 拆牌惩罚 5.5 → 0 | `cur-break0` | 472/500 | 0.944 | 0 | 2.59 | 惩罚有效 |
| 拆牌惩罚 5.5 → 3 | `cur-break3` | 472/500 | 0.944 | 0 | 2.63 | 5.5 优于 3 |

**显著性提示（队长定性）**：500 副的标准差 σ≈2.2 局，约 3 局 ≈ 1σ。因此 `0.952 vs 0.946`（+3 局）应写成「**有正面信号但未达显著**」，不能写成结论；`0.948`、`0.944` 与 `0.946` 的差异同样在噪声范围内。拆牌惩罚 5.5 保留（0 和 3 都掉到 0.944），但改善幅度也仅 1 局，属弱信号。

---

## 5. 全量测试清单

**最终口径**：09:40 前后在 `HEAD=4939162`、工作树 `engine.js` sha12=`fca77dcfc89b` 下重跑 7 条，全部 `exitCode=0`（后台作业 `pwsh-90bc40170aa046e8`）。首轮约 09:00 在 `HEAD=43e04c9` 跑过一轮（当时 `sample-hands` 是 9 通过、合计 112）；`e409560` 给 `sample-hands.test.mjs` 追加「确定性向量：3/4/5/6/7 各一张，mode0/mode1 一手 34567、mode2 要 5 手」后变成 10 通过，故下表按最终重跑计 **113 通过 / 0 失败**。engine.js 字节自 `0f4125b` 起未变，测试结论不受 HEAD 前进影响。

| # | 命令 | 通过 | 失败 | 退出码 | 备注 |
|---|---|---|---|---|---|
| 1 | `node plugin/dsh-doudizhu-game/test/game.test.mjs` | 12 | 0 | 0 | 结算 / 阶段回归 |
| 2 | `node plugin/dsh-doudizhu-game/test/movegen.test.mjs` | 45 | 0 | 0 | 出牌生成 |
| 3 | `node plugin/dsh-doudizhu-game/test/advise-heuristic.test.mjs` | 18 | 0 | 0 | 8 类启发式局面；31 个局面 → 22 出牌 / 9 过牌，全部合法 |
| 4 | `node plugin/dsh-doudizhu-game/test/sample-hands.test.mjs` | 10 | 0 | 0 | 采样守恒 + 贪心 mode 差异 + `e409560` 确定性向量；含「三个 mode 至少 10 组手牌首手不同，且 planCount 不劣于 mode 0」 |
| 5 | `node plugin/dsh-doudizhu-game/test/bid-strength.test.mjs` | 13 | 0 | 0 | 叫分 / 加倍阈值边界 7.4/5.6/4.0 |
| 6 | `node plugin/dsh-doudizhu-game/test/fallback-move.test.mjs` | 15 | 0 | 0 | 兜底不拆炸弹 / 领出非 null / 信息通道 |
| 7 | `node tools/diff-moves.cjs 200` | — | — | 0 | 200 轮随机手牌（每轮 2 副）+ 15 副构造手牌，对 rlcard `card_type.json` 27471 条权威动作：`漏解 0`、`多出 0`、`classify 返回 null 0` |

合计：**113 通过 / 0 失败**（前 6 条），差分测试 0 漏解 / 0 多出 / 0 无法识别。`advise-heuristic` 的 e 类局面还留着「只有炸弹/王炸能压就先过」与 c 类「先过一手」逻辑（队长 09:26 单点消融的对象），见 §4.1。

---

## 6. 已知噪声与坑

1. **端口 8791 串引擎（最危险）**：`ab-run` 起桥前若 8791 上还挂着上一轮的 `node tools/bridge.mjs`，`/health` 会命中旧进程，A/B 两轮实际跑同一个引擎而结果却互相污染。历史事故：同一引擎跑出 **0.905 / 0.985 / 0.890** 三个互相矛盾的胜率，根因就是端口未释放、健康检查打到旧进程。本次复跑期间 09:16 又观察到 8791 被另一轮消融占用（PID 11172 bridge + PID 5648 `arena.py ... --out arena\result-ab-v9.json`），exec-verify 按兵不动、等端口释放再起，未 `Kill-Bridge` 打断别人的对局。
2. **指纹校验**：队长已修 —— `tools/engine.cjs` 导出 `__src` / `__sha`（文件字节 sha256 前 12 位），`/health` 返回；`tools/ab-run.ps1` 先 `Kill-Bridge`、再 `Wait-PortFree(8791, 8000)`，随后要求 `/health` 含 `ok` 且 sha 与目标引擎一致，不一致写 `FAIL start <name> (want sha <sha>)` 并跳过。看到这条 FAIL 说明校验生效，**贴进文档，不要改脚本绕过**。
3. **快照缺失**：`-List` 里的非 `current` 名字都映射到 `$env:TEMP\engine-<name>.js`；文件不在就写 `FAIL missing engine <path>`。本次开工时 `engine-base.js` / `engine-v9.js` / `engine-v15.js` 全部不存在（08:51:13 日志留下 `FAIL missing engine（TEMP 路径）`），已按 git blob 重建并逐字节校验后重跑。
4. **哈希种子导致的判定不确定（已修复，`0f4125b`）**：`arena/arena.py` 的 min 对手原用 `min(plays, key=len(牌))`，而 `legal_actions` 的遍历顺序受 Python 的 `PYTHONHASHSEED` 影响，同长度候选每次取的牌不同 → **同一个引擎、同一个 seed，500 副能差 31 局**（观测 `0.898` vs `0.960`）。这不是随机噪声，是判定性 bug。修法：`min(key=(len, 牌面字符串))`、`find_action` 按 id 排序、`tools/ab-run.ps1` 里 `$env:PYTHONHASHSEED='0'`。**验证方法**：同一 bridge、同 seed 连跑两次并逐局 diff 结果 JSON —— 修复前 100 副有 65 局不同，修复后 100 副 diff = 0。base 的两组历史观测（`0.960` @08:42、`0.898` @08:59、以及 09:03 同引擎 200 副 `0.955` / `0.935`）全部标注「**修复前，作废**」，不用于门禁，也不解释为噪声。
5. **PowerShell 执行策略拦截未签名脚本（本次新增）**：本机 `Get-ExecutionPolicy -List` 的 `CurrentUser = RemoteSigned`，`tools\ab-run.ps1` 无数字签名。09:14:33 起的 6 条 ab-run 后台作业全部报 `无法加载文件 … 未对文件进行数字签名`（SCRIPT_ERROR ×6、0 对局），只往 `%TEMP%\ddz-ab-log.txt` 写了 `### exec-verify START/CMD/ERROR` 标记。**处理**：在**同一条 pwsh 调用内**先 `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force`，再 `& .\tools\ab-run.ps1 ...`；作用域仅该进程，不改仓库脚本、不改用户/机器策略。已用 `-List __smoke__ -Games 1` 验证脚本可正常加载（输出 `FAIL missing engine ...engine-__smoke__.js`）。看日志要区分「SCRIPT_ERROR（脚本没跑）」与 `FAIL missing engine`（脚本跑了、快照缺）。
6. **current 版本链要标清**：`src/engine.js` 历经 `43e04c9`（greedyPick 三 mode，sha12 `17900314984b`）→ `0f4125b`（planCount[0] + 确定性，sha12 `fca77dcfc89b`）→ `e409560`（只动测试与 client.js）→ `4939162`（只改 README；复跑时的 HEAD），后两个提交 engine.js 字节均不变。`fca77dcfc89b` 在 `0f4125b` 已提交，不再是 08:59 的未提交补丁；`ab-run` 的 `current` 始终从工作树读，运行指纹以 `fca77dcfc89b` 为准，日志不记 sha，故每节标题标 `current @ <sha12>`。
7. **`base` 的 `illegal=4` 是旧引擎已知缺陷，不是环境噪声（队长定性）**：`main`（`e45178236455`）的旧 `generateMoves` 会产出 `3,3,3,3,16,17`（四带二带双王）这类 rlcard 判非法的动作，被测引擎把它当合法建议发给桥，竞技场在合法动作集里找不到 → 触发 `illegal_fallbacks` 兜底随机走一步。队长 09:15 消融轮里 `base illegal=4`，而 `v9 / v15 / current` 全是 `illegal=0`，正对应 `8c9560c` 修掉的 movegen/classify 缺陷之一。它属于被测引擎本身的质量问题，应计入引擎对比（旧引擎会白白丢掉 4 步），**不得**写成「桥的问题 / 环境噪声 / 随机抖动」而抹平。
8. **指标口径**：`avg_decision_ms` 是 `1000 * 总耗时 / 总步数`，包含 Python 裁判步进与 HTTP 往返，不等于引擎纯计算耗时；不同轮次机器负载会带来差异，胜率一致时 ms 有微小差别属正常（如队长官方 min 两条 `ms=2.92/2.58` 与消融轮 `ms=2.74` 量级一致），如实记录不抹平。
9. **PowerShell 参数引号（本次新增）**：`ab-run.ps1` 的 `param([string]$List, [int]$Games, …)` 在 PowerShell 里 `-List base,current` 会被解析成数组 `@('base','current')`，`base` 绑定 `-List`、`current` 落到位置参数 `$Games` → `无法处理对参数“Games”的参数转换。无法将值“base,current”转换为类型“System.Int32”。错误:“输入字符串的格式不正确。”`。09:25:56 的 5 条复跑全部这样失败（0 对局，`[RUN_ERROR]`，日志只有 CMD/ERROR 标记），和 09:14 的 `SCRIPT_ERROR` 是两回事。**正确写法必须带引号**：`-List "base,current"`；脚本化时用 hashtable splatting `@{ List='base,current'; Games=500; Seat=0 }` 等价。队长给的 4 条命令都是带引号的形式。
10. **端口守卫不能看错端口（本次新增）**：`ab-run` 自己只占 `8791`。我在外层加的 `Wait-Quiet` 曾把「任意 `arena.py` 进程 / 任意 `bridge.mjs` 进程」都当作 8791 忙，09:31:09 [2/5] min seat1 因此被别人在 **8801** 的 SOTA 实验（PID 4588 `node tools/bridge.mjs 8801` + 其 python）饿住，8791 实际是 FREE，日志停在 CMD 行没有结果。已 `job_kill` 该作业（[1/5] min seat0 数字仍有效），改为只检测 `Get-NetTCPConnection -LocalPort 8791` 与命令行里明确含 `bridge.mjs 8791` / `--port 8791` 的进程后重跑余下 4 组。跨组并发时端口守卫必须按端口精确匹配，否则「等端口释放」会变成永久等待。
11. **门禁与样本量**：确定性修复后同引擎同 seed 逐局可复现，但 500 副仍是门禁口径；200 副只作噪声演示，不作验收依据；单点改动差 3 局 ≈ 1σ（500 副 σ≈2.2 局），只能算「正面信号」，不能当显著结论。

---

## 7. 结论

以 §3 的 500 副正式数字为准（确定性口径、`current @ fca77dcfc89b`、exec-verify 独立复跑）：

1. **min 对手门禁通过**：landlord `0.946 ≥ 0.936`、farmer `0.898 ≥ 0.890`，两条都不低于 `base`，**未触发「未达门禁」**。独立复跑的胜局数与队长官方完全一致，没有改动队长数字。
2. **bridge 自对弈不粉饰**：landlord `0.522 < 0.532`（-5 局）、farmer `0.478 > 0.468`（+5 局），两侧恰好抵消；这是双方同引擎的对称结果，记录为平手偏噪声，不作为门禁依据，也不写成「全面胜出」。
3. **消融归因**（§4）：`current` 与 `v15` 在 go 档逐局同分，无第三个变量；相对 `base` 的增量主要来自 movegen/classify（seat 0 +4 / seat 1 +3 局），拆牌罚 5.5 各 +1 局，均为 1σ 级弱信号。修复前 08:42 那组「current 掉 2.4 点」由 `PYTHONHASHSEED` bug 造成，已作废；确定性修复后不复现。
4. **单点改动**（§4.1）：去掉「地主放上家小牌先过一手」476/500 = 0.952 是**唯一有正面信号但未达显著**的候选（+3 局 ≈ 1σ，500 副 σ≈2.2 局）；去掉「只有炸弹能压就过」与两条都去掉均无叠加收益；拆牌罚 0 / 3 都回落到 0.944，维持 5.5。
5. **测试**：7 条全量测试 113 通过 / 0 失败，`diff-moves.cjs 200` 对 27471 条权威动作 0 漏解 / 0 多出 / 0 无法识别；`illegal_fallbacks` 在正式矩阵四轮均为 0，旧引擎消融轮的 4 次非法兜底已定性为 base 自身缺陷。

**总判定：current 达到 500 副 min 门禁（无回退），但未证明统计显著的大幅领先；后续若要继续提升，优先复测「先过一手」单点改动（需更大样本），不要据 3 局差距直接改结论。**

---

## 附录：日志与产物

- A/B 日志：`%TEMP%\ddz-ab-log.txt`（每轮 `=== run <ISO> ===` … `=== done ===`，逐行格式 `<name> : <wins>/<games> = <win_rate> illegal=<n> ms=<avg>`）；旧日志备份 `%TEMP%\ddz-ab-log.before-t13.txt`。正式复跑定位标记：`### exec-verify t13 RERUN2 START 2026-11-09T09:28:52.3848084+08:00`（min seat0 行）、`### exec-verify t13 RERUN3 START 2026-11-09T09:37:56.6023546+08:00` … `### exec-verify t13 RERUN3 DONE 2026-11-09T09:55:12.1397783+08:00`（余下 4 组）。队长消融/单点轮标记：`=== run 2026-11-09T09:15:42.6342198+08:00 ===`（seat0 消融）与 `=== run 2026-11-09T09:19:36.0695558+08:00 ===`（单点改动）。
- 结果 JSON：`arena/result-ab-<name>.json`（已被 `.gitignore` 的 `arena/result-*.json` 忽略，不进 git status）；确定性验证方法 = 同名两次输出逐局 diff。后台作业：`pwsh-23a62ca7077e4a42`（RERUN2，kill）、`pwsh-ea757f8c5e394933`（RERUN3，exit 0）、`pwsh-90bc40170aa046e8`（7 条 node 测试，exit 0）；`pwsh-7a6a9337a25e4cc9`（SCRIPT_ERROR）与 `pwsh-a07f684a10bd4a09`（参数引号错误）均已作废、不产生对局。
- 指纹核对：`Get-FileHash <engine file> -Algorithm SHA256`，取前 12 位小写；TEMP 快照另用 `git hash-object` 对目标 commit 的 blob 校验。
- 执行策略：`Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force`（仅当次 pwsh 进程有效），用于让未签名的 `tools/ab-run.ps1` 可加载；不改仓库文件。
- 文档交付：`doudizhu/docs/logic-bench.md`（本任务唯一新增文件）。开工前 `git status --short` 已存在他人改动 `M tools/ab-run.ps1` / `M tools/bridge.mjs` / `M tools/engine.cjs`（指纹校验前置改动），以及未跟踪 `ai/`；本任务不修改它们、不改 engine.js / game.js / ui.js。

---

## 8. 强度基准：对 DouZero WP（2026-11-09 追加）

前面的 min / bridge 只能做回归，不能当强度依据。本节改用训练过的 DouZero WP 权重当**对手**。

### 8.1 怎么跑

```bash
powershell -ExecutionPolicy Bypass -File tools/bench-vs-douzero.ps1 -Games 300 -Tier go
```

脚本起两个桥：8801 = 本引擎（被评测方），8802 = 同一份 bridge 但 `DZ_SOTA_FARMER=1`，
让地主与两个农民都由 DouZero 决策。`arena.py` 用 `--opp-port 8802` 指向对手桥
（`--port` 只能指一份引擎，故新增 `--opp-port`）。`PYTHONHASHSEED=0` 必须固定。

### 8.2 结果（seed=1，`PYTHONHASHSEED=0`）

| 我方档位 | 座位 | 样本 | 胜率 | illegal |
|---|---|---|---|---|
| `go` | 地主 | 300 | **0.553** | 0 |
| `go` | 农民 | 300 | **0.447** | 0 |
| `pro200` | 地主 | 200 | 0.540 | 0 |
| `pro200` | 农民 | 200 | 0.515 | 0 |
| `sota`（DouZero 对 DouZero，对称性检查） | 地主 | 100 | 0.620 | 0 |

产物：`arena/result-vs-douzero-{lord,farmer}-{go,pro200}.json`、`result-vs-douzero-sym-100.json`。

### 8.3 读法

- **整体五五开**：地主 0.553、农民 0.447，都在 0.5 附近，样本 σ≈2.9%，属同一水平线。
- **对称性检查 0.620 是关键对照**：同一套 DouZero 权重，地主模型打农民模型能到 0.62，
  说明"地主位 + 地主模型"本身占优。因此不能把 0.553 / 0.447 读成"我方地主强、农民弱"。
- **`pro200` 在农民位更好**（0.515 vs 0.447）：蒙特卡洛推演在信息不完全的农民位有正收益，
  与 `sota vs plus` 农民位 0.4433 的结论方向一致（DouZero 农民模型偏弱）。
- 对 min 的 0.946 / 0.898 **只作回归门禁**，不进入本节结论。

### 8.4 已知局限

- DouZero 只覆盖 WP 变体；ADP / SL 权重在 HF 镜像里也有，未跑。
- 对手桥把 DouZero 当"策略后端"用，其输入历史由 bridge 从 trace 重建，若 trace 与真实
  出牌序列有偏差（例如中途 pass 记录），对手强度会被低估——这一点已由 `sota vs plus 0.697`
  的独立结果交叉验证，量级可信。
- PerfectDou 因编码器依赖 Linux `.so`，Windows 下无法当对手，暂缺这一强基线。
