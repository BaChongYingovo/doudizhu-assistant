# doudizhu-assistant

斗地主：一个能在 DSH 左侧栏里直接打人机对局的插件，外加一个给引擎做强度评测的竞技场。

以前的单文件 HTML（浏览器打开、自己记牌、问建议）已经退役，功能都搬进了插件。

## 插件：dsh-doudizhu-game

完整说明见 [plugin/dsh-doudizhu-game/README.md](plugin/dsh-doudizhu-game/README.md)。

- 入口：左侧「更多」菜单一行「斗地主」，点开占满主区
- 你坐 0 号位，1 号下家、2 号上家；三家各自选难度
- 叫分 / 抢地主 → 加倍 / 超级加倍 / 明牌 → 出牌 → 结算 → 复盘
- 记牌器、出牌建议（带理由和估计胜率）、提示循环、30 秒倒计时、托管
- 中英双语、跟随 DSH 深浅色、音效开关、战绩存本地

### 七档难度

| 档位 | 做法 |
|---|---|
| `free` | 乱打，练手用 |
| `go` | 规则启发式：记牌、配合队友、顶牌、不乱开炸 |
| `plus` | 启发式 + 12 次局面推演 |
| `pro100` | 推演 100 次 |
| `pro200` | 推演 200 次 |
| `pro500` | 推演 500 次 |
| `pro9999` | 推演到 4 秒为止（最强也最慢） |

### 安装

插件放 `~/.dsh/plugins/dsh-doudizhu-game`，然后在 `~/.dsh/profiles/desktop/package.json` 里登记：

```jsonc
{
  "dependencies": {
    "dsh-doudizhu-game": "link:C:/Users/<you>/.dsh/plugins/dsh-doudizhu-game"
  },
  "dsh": { "profile": { "bundles": [ /* … */ "dsh-doudizhu-game" ] } }
}
```

重启 DSH、刷新页面即可。纯客户端插件，无需构建服务。

### 开发与测试

```bash
cd plugin/dsh-doudizhu-game
node build.mjs               # src/*.js -> client.js
node test/game.test.mjs      # 规则核心：发牌、叫分、倍数、结算、300 局自对局
node test/render.test.mjs    # 假 React 渲染自测：注册、开局、托管整局、结算、再来一局
node test/check-keys.mjs     # 文案与 API 引用检查
```

## 竞技场：arena/arena.py

用 rlcard 的 DouDizhu 环境当裁判，把本地引擎接成选手，跑指定档位对指定对手的 N 局，输出胜率与决策耗时。

```bash
node tools/bridge.mjs &        # 引擎桥，127.0.0.1:8791
python arena/arena.py --games 200 --tier pro200 --opp min --seat 0
```

`--opp random | min | bridge`；`bridge` 时用 `--opp-tier` 指定对手档位（rlcard 需要手工装，见 `arena/arena.py` 头注释）。结果 JSON 落在 `arena/result-*.json`。

### 已测基线（规则对局，不是强 AI）

| 对局 | 局数 | 胜率 |
|---|---|---|
| 地主 vs 两个随机农民 | 300 | 0.95 |
| 农民（座 1）vs 两个随机 | 300 | 0.96 |
| 地主 vs 两个「能出就出最少」贪心 | 200 | 0.945 |
| 农民（座 1）vs 两个贪心 | 200 | 0.775 |

这些数字只说明引擎没犯低级错误，不代表强度上限；要跟 DouZero / PerfectDou 这种训练过的模型比才算数（相关源码和权重在本地 `research/`，未入仓）。

## 目录

```
plugin/dsh-doudizhu-game/   插件（src + client.js + 测试）
arena/arena.py              rlcard 裁判
tools/bridge.mjs            Node 引擎桥（供 arena 调用）
engine.js                   引擎源码（竞技场用；插件里有同一份拷贝）
engine.test.js              引擎单测
```

## 边界

- 不做自动代打、不注入游戏本体：插件只在本地开自己的牌局
- 牌面识别不做图像 OCR：截图发到对话里我读，或直接点选
- 实时建议属于辅助，线上排位是否允许以平台规则为准
- 单文件离线版面已退役，不再维护 HTML 版本
