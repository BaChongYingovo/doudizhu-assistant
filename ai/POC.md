# PerfectDou ONNX / Node 推理可行性 POC

**结论：通。** Node 侧 `onnxruntime-node@1.31.1` 能直接加载三个 vendored ONNX 权重、跑通前向，621 维输出可经 `action_space.json` / `specific_map.json` 映射回 rlcard 的 27471 条 `card_type.json` 动作；本机 200 次前向 p50 **0.996 ms**、p95 **1.403 ms**，`ai/node_modules` **294.58 MiB (308.89 MB)**。这是独立可行性验证，**没有改 `plugin/`、没有接 UI、没有改 engine.js / 结算公式 / 状态机**。

## 运行方式（可重复）

```bash
cd doudizhu/ai
npm install                 # 仅首次；onnxruntime-node 固定在 package.json/package-lock.json = 1.31.1
node poc.mjs                 # 或 npm run poc
```

`poc.mjs` 只读 `../research/dist/PerfectDou-main/` 下的权重与 JSON，不复制权重到 `ai/`；`ai/.gitignore` 已忽略 `node_modules/`。

## 环境与输入契约

| 项 | 实测值 |
|---|---|
| Node | v24.22.1 |
| npm | 11.19.1 |
| onnxruntime-node | 1.31.1（装到 `doudizhu/ai/node_modules`） |
| `landlord.onnx` | 4.25 MiB (4,452,574 bytes) |
| `landlord_up.onnx` | 4.25 MiB (4,456,021 bytes) |
| `landlord_down.onnx` | 4.25 MiB (4,454,669 bytes) |
| `ai/node_modules` | 308,893,503 bytes = 294.58 MiB (308.89 MB) |
| 输入张量 | 3 个模型均为 `float32` `["unk__214", 32738]`，name 分别为 `ppo2_model/landlord/Ob:0` / `ppo2_model/landlord_up/Ob:0` / `ppo2_model/landlord_down/Ob:0` |
| 输出张量 | 3 个模型均为 `float32` `["unk__215", 621]`，name `action_logit` |
| `action_space.json` | 621 个抽象动作 id（0..620，`pass`=620） |
| `specific_map.json` | 27472 个 key = 27471 条具体动作 + `pass`，每个 key 映射到 1 个或多个抽象动作 key |
| `card_type.json` | 27471 条 rlcard 权威具体动作（与 `research/dist/rlcard-1.2.0/.../jsondata/card_type.json` 的 key 集合完全一致） |

ONNX 图（opset 13，187 nodes）里的常量把 32738 维输入拆成三段，这也是 `poc.mjs` 构造 InfoSet 的依据：

- `[0:4680]` → `Reshape [-1, 26, 12, 15]` 状态平面；`Slice [4:19]` 拍平成 5×540 历史步，`Slice [2:4] + [19:]` 拍平成 1620 维牌特征。
- `[4680:4688]` 8 个额外标量；图里把 `[2:8]` 这 6 个拼到牌特征后面（动作特征第一层权重 `[1940, 256]` 对应 `Concat(1754维状态特征, 186维动作特征)`，其中 1754 = 1620 牌特征 + 6 额外标量 + 128 LSTM 末步输出）。
- `[4688:32738]` → `Reshape [-1, 150, 187]`：最多 150 个合法动作槽，每槽 187 维。图里 `Slice[0:1]` 经 `OneHot(depth=621)` 还原抽象动作 id，`Slice[6:7]` 经 `Greater(>0)` 得到合法性 mask，`Slice[1:]` 的 186 维是动作特征；未覆盖动作输出被压成 `-3.4028234663852886e+38`。

上游 `perfectdou/env/encode.py` 只以 Linux `encode.cpython-37m-x86_64-linux-gnu.so` 发布（本仓库 833,792 bytes），Windows 无法执行；`perfectdou_agent.py:57-62` 也只说明 `np.concatenate([x_no_action.flatten(), legal_actions_arr.flatten()]).reshape(1,-1)` 喂进去、`argmax(logit)` 经 `_decode_action` 还原动作。因此本 POC 用 ONNX 常量 + `env.py::_cards2array` + 三个 JSON 反推并**实测验证**了动作槽语义（col 0 = abstract id、col 6 = legality），状态平面按 `[26,12,15]` 布局自洽构造了一个真实开局。这个限制不影响「能否加载 / 前向 / 映射动作 id / 测速」的结论，但接正式 SOTA 前需要补一份与 `.so` 完全等价的编码器（见下）。

## 真实局面与动作映射

`poc.mjs` 用与 `generate_eval_data.py` 相同的 54 张牌堆（3..A×4、2×4、B、R），固定种子 `20261109` 洗牌，地主 20 张、两家各 17 张、底牌 3 张：

- 从 `card_type.json` 的 27471 条具体动作里筛出当前手牌能组成的 **52 条合法具体动作**，经 `specific_map.json` 折叠成 **52 个抽象动作槽**（其余 98 槽 mask=0）。
- 三个模型各跑一次前向，均返回 `[1, 621]`，其中恰好 **52 个有限 logit**（与合法槽数一致），其余为 `-3.4028234663852886e+38`。
- 地主模型 `argmax` 得到抽象 id **15**（`action_space.json` 的 `"33"`），再经 `specific_map.json` 找到该手牌下对应的具体动作 `"33"`，它在 `card_type.json` 的 27471 条动作里索引为 **9**。映射闭环成立：`621 logits → abstract id → 27471-action card_type.json`。

### 前向跑通原始输出片段（原样摘录 `node poc.mjs`）

```
[meta] landlord.onnx input=ppo2_model/landlord/Ob:0 type=float32 shape=["unk__214",32738] | output=action_logit shape=["unk__215",621]
[meta] landlord_up.onnx input=ppo2_model/landlord_up/Ob:0 type=float32 shape=["unk__214",32738] | output=action_logit shape=["unk__215",621]
[meta] landlord_down.onnx input=ppo2_model/landlord_down/Ob:0 type=float32 shape=["unk__214",32738] | output=action_logit shape=["unk__215",621]
[forward] landlord.onnx output dims=[1,621] len=621 finiteLogits=52
[forward] landlord_up.onnx output dims=[1,621] len=621 finiteLogits=52
[forward] landlord_down.onnx output dims=[1,621] len=621 finiteLogits=52
[forward] raw logits[0..9] = [
  -9.326872825622559,
  -16.8559513092041,
  -3.4028234663852886e+38,
  -3.4028234663852886e+38,
  -13.327223777770996,
  -12.821878433227539,
  -11.304035186767578,
  -11.488202095031738,
  -3.4028234663852886e+38,
  -15.748542785644531
]
[forward] masked logits[10..12] = [ -15.363900184631348, -11.439465522766113, -13.359946250915527 ] (illegal ids = -3.4028234663852886e+38)
[forward] argmax abstract id = 15 key = 33 logit = -6.595047473907471
[forward] finite abstract ids = 52 expected slots = 52
[map] abstract id 15 -> "33" -> concrete "33" -> rlcard card_type index 9 of 27471
[map] OK: 621 logits -> abstract id -> 27471-action card_type.json
[bench] 200 forwards landlord.onnx  p50=0.996ms  p95=1.403ms  min=0.709ms  max=11.540ms
[size] ai/node_modules = 308893503 bytes = 294.58 MiB (308.89 MB)
=== POC DONE: 通 ===
```

## 200 次前向耗时

| 指标 | 实测 |
|---|---|
| warm-up | 10 次 |
| 样本 | 200 次 `landlord.onnx` `session.run()` |
| p50 | **0.996 ms** |
| p95 | **1.403 ms** |
| min / max | 0.709 ms / 11.540 ms |

`node_modules` 体积：**308,893,503 bytes = 294.58 MiB (308.89 MB)**。其中大头是 `onnxruntime-node` 自带的多平台原生二进制（win32/linux/darwin × x64/arm64 的 `onnxruntime.dll` / `.so` / `.dylib` / `DirectML.dll` / `.node`），不是纯 JS。

## 若接进浏览器还差什么

1. **运行时换 `onnxruntime-web`**：Node 版带 295 MiB 原生二进制，浏览器要换成 WASM/SIMD backend，并验证 opset 13 的 `NonZero` / `ScatterND` / `OneHot` / LSTM 展开图都能跑；必要时把模型重新导出成 Web 友好算子子集。
2. **权重下载与缓存**：三个 ONNX 共约 **12.74 MiB**。现在它们在 `research/dist/` 里，不在 `plugin/` 静态资源里；浏览器侧需要 CDN/打包下载、版本校验、IndexedDB 缓存与「模型未就绪时回退到现有 go/plus 启发式」的降级路径。THIRD_PARTY/LICENSE 由队长后续补，本 POC 不提交权重。
3. **Worker 隔离**：前向放进 Web Worker（或 SharedWorker），主线程只收 `action_logit`；需设计消息协议、超时、取消、并发上限，避免 621 维计算阻塞 UI 出牌动画。
4. **InfoSet 编码器对齐**：本 POC 的动作槽 col 0/col 6 已由图常量+实测验证，但 `encode.py` 是闭源 Linux `.so`，状态平面 `[26,12,15]` 的完整语义（历史 15 手、明牌/底牌、炸弹数、`caculate_left_hands` 特征）尚未逐位复刻。正式接入前需要在 Linux/Python 侧用 `encode_obs_landlord` / `encode_obs_peasant` 导出黄金张量快照，Node/浏览器侧逐位对拍，否则策略输出会「能跑但分布不对」。
5. **动作解码闭环**：`_decode_action` 在 `.so` 里；目前 `specific_map.json` 可以完成「抽象 id → 具体动作 → 27471 action_space」的静态映射，但跟牌时的合法动作过滤、双王/炸弹/飞机翅膀等仍需接回插件 `generateMoves`（本任务禁止动 `plugin/`，留给后续 SOTA 接线任务）。
6. **评测**：这里的 p50/p95 只证明单次前向快；真实收益要等 `tier=sota` 接线后跑竞技场 1000 副锦标赛再判断。

## 已知边界（不影响「通」的结论）

- 上游编码器为 Linux-only 编译模块，本 POC 的状态块是按 ONNX 图常量与 `env.py` 可见的 `_cards2array` 自洽重建，并非 `.so` 的逐位输出；动作槽语义和 621→27471 映射是精确验证过的。
- `specific_map.json` 有 9 条「飞机纯主体」动作映射到多个抽象 key（例如 `333444555666` → `["333444555666","333444555***","444555666***"]`）；`poc.mjs` 取第一个在 `action_space.json` 中的 key，正式解码需按 `card_type.json` 的 `[type, chain]` 消歧。
- 200 次耗时在本机 Windows / Node 24 / CPU 上测得；换机器、WASM backend、并发 Worker 后数字会变。

## 产物

- `ai/poc.mjs` —— 可重复运行脚本（前向 / 形状 / 映射 / 200 次测速 / 体积）。
- `ai/POC.md` —— 本文件。
- `ai/package.json`、`ai/package-lock.json` —— 固定 `onnxruntime-node@1.31.1`。
- `ai/.gitignore` —— `node_modules/` 不进 git。
- `ai/node_modules/` —— 本机安装产物，不提交。
- 未新增/修改 `doudizhu/plugin/` 下任何文件，未复制或提交 ONNX 权重。
