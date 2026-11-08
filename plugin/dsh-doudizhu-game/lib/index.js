// dsh-doudizhu-game —— 纯客户端插件。
//
// Host 侧没有服务、没有工具，只声明一个 loader 条目；真正的界面在 client.js
// （package.json 的 dsh.client 指过去），注册到 main / sidebar.panellist /
// sidebar.panellist.actions 三个槽位。

export const name = 'dsh-doudizhu-game'

export function apply() {
  // 什么都不用做：界面全在客户端。
}
