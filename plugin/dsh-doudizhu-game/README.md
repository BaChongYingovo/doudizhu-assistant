# dsh-doudizhu-game

在 DSH 里直接打斗地主：和两个 AI 打，三家各自选难度；带记牌器、出牌建议、叫分/抢地主、加倍、明牌、完整结算和复盘。

- 入口：左侧「更多」菜单里的一行「斗地主」，点开占满主区
- 人机对战：你坐 0 号位，1 号是下家、2 号是上家
- 不联网、不读写游戏本体、没有外挂行为：纯本地牌局

## 玩法

| 阶段 | 说明 |
|---|---|
| 叫分 | 不叫 / 1 / 2 / 3 分，最高者当地主；三家都不叫就重新发牌。开局也能切到「抢地主」玩法 |
| 加倍 | 定地主后三家同时选：不加倍 / ×2 / 超级加倍 ×4；还能明牌（每家明牌再 ×2） |
| 出牌 | 点牌选中（按住滑动可连选），「出牌」下牌、「不出」过牌、「提示」循环给可出牌、「问军师」看出牌建议 |
| 结算 | 底分 1 × 叫分/加倍 × 明牌 × 炸弹（每个 ×2）× 春天/反春 ×2；三家各自显示得分 |
| 复盘 | 结算里「复盘」可以上一步/下一步手动翻整局 |

牌型按常见规则：单张、对子、三张、三带一/二、顺子（5 张起）、连对（3 对起）、飞机带单/带对、四带两单/四带两对、炸弹、王炸（最大）；2 和大小王不进顺子/连对；三带一允许带单王。

## 八档难度

三家分别选，互不影响；托管时用你自己的档位代打。

| 档位 | 思路 |
|---|---|
| `free` | 乱打：多数时候随机出合法牌，练手用 |
| `go` | 规则启发式：记牌、配合队友、顶牌、不乱开炸 |
| `plus` | 在 go 基础上做 12 次局面推演，微调选牌 |
| `pro100` | 推演 100 次 |
| `pro200` | 推演 200 次 |
| `pro500` | 推演 500 次（单次可能到 0.8 秒） |
| `pro9999` | 推演到 4 秒为止，最强也最慢（会显示「思考中…」） |
| `sota` | DouZero 冠军模型（Apache-2.0）：地主位走神经网络，农民位回退 `go`。首次选它要下载 5.6 MB 权重，可离线缓存 |

`sota` 不需要任何原生依赖：插件里自带 ONNX 权重解析和 LSTM 前向，单次决策约 15 ms
（见 `src/sota.js`、`test/sota.test.mjs`）。权重只在你真的选了这一档时才下载；
官方源不通会自动切镜像，校验不过就降级成 `go` 并在建议卡里写明原因。

## 安装

插件目录放在 `~/.dsh/plugins/dsh-doudizhu-game`，然后在 DSH 的 profile 里登记：

1. `~/.dsh/profiles/desktop/package.json` 的 `dependencies` 加一行：
   `"dsh-doudizhu-game": "link:C:/Users/<你>/.dsh/plugins/dsh-doudizhu-game"`
2. 同一个文件的 `dsh.profile.bundles` 数组里加 `"dsh-doudizhu-game"`
3. 重启 DSH 宿主（或重载插件），刷新 Web 页面

纯客户端插件，不需要构建服务；`client.js` 已经是从 `src/` 打好的单文件产物。

## 开发

```bash
node build.mjs               # src/{engine,game,i18n,style,ui,sota}.js -> client.js
node test/game.test.mjs      # 规则核心（发牌/叫分/倍数/结算/300 局自对局）
node test/sota.test.mjs      # DouZero：ONNX 解析、纯 JS 前向对齐 onnxruntime、下载/镜像/sha256、引擎接线
node test/render.test.mjs    # 假 React 渲染自测（注册/开局/托管整局/结算）
node test/check-keys.mjs     # 文案与 API 引用检查
```

## 结构

```
src/engine.js   牌型识别、出牌生成、八档 advise（sota 走外部钩子）
src/sota.js     DouZero 权重解析 + LSTM 前向 + 下载/缓存/校验
src/game.js     规则核心 GameCore(DDZ)：状态机、叫分/加倍/明牌、结算、AI 走子、sotaCtx
src/i18n.js     中英双语文案
src/style.js    样式（跟随 DSH 深浅色）
src/ui.js       界面：开局面板、牌桌、手牌、记牌器、建议卡、结算/复盘/说明弹层
build.mjs       拼装成 client.js
```
