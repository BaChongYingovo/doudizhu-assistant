# 第三方组件

本仓库**不提交**任何模型权重；`ai/models/` 被 `.gitignore` 排除，按 `ai/models/MANIFEST.json`
在运行时下载并校验 sha256。

| 名称 | 版本 / commit | 许可 | 链接 | 用途 |
|---|---|---|---|---|
| DouZero | 论文 ICML 2021；权重为官方 `douzero_WP` baseline | Apache-2.0 | https://github.com/kwai/DouZero | 出牌策略模型（ONNX 双输入 z/x），`ai/douzero.mjs` |
| DouZero ONNX 镜像 | HuggingFace `palemoky/douzero-baselines` | Apache-2.0（模型的许可随上游） | https://huggingface.co/palemoky/douzero-baselines | 官方 ckpt 转好的 ONNX，供直接下载 |
| PerfectDou | 源码快照 | Apache-2.0 | https://github.com/Netease-Games-AI-Lab-Guangzhou/PerfectDou | 只做过 Node 侧 ONNX 前向可行性验证，见 `ai/POC.md` |
| rlcard | 1.2.0 | MIT | https://github.com/datamllab/rlcard | 竞技场裁判（`arena/arena.py`），仅本地评测用，不入包 |
| onnxruntime-node | 1.31.1 | MIT | https://github.com/microsoft/onnxruntime | Node 侧推理；浏览器版（onnxruntime-web）尚未接入 |

编码器说明：`ai/douzero.mjs` 的 `cards2array / encodeZ / encodeBase` 按 DouZero `env.py:230-266`
与 `_get_obs_landlord*` 的字段顺序逐项重写，并用 `ai/test-encoder.mjs` 对 `ai/golden-encoder.json`
（由 `ai/validate-encoder.py` 独立生成）做逐维比对，319/430 维全部一致。
