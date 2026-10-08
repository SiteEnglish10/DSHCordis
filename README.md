# DSHCordis

按 docs/cordis-plugin-spec.md 开发，目标接口 DSH 0.2.0-rc.2。零运行时 npm 依赖。

| 插件 | 当前状态 | 本地目录 |
| --- | --- | --- |
| @liming999/balance 0.2.1 | 已修复 RPC 注册上下文；API Key 余额待真实 DSH 验收 | packages/balance |
| @liming999/offpeak 0.2.1 | 已修复 RPC 注册上下文；自动发送待真实 DSH 验收 | packages/offpeak |

## 本地安装

插件页使用下列绝对目录安装，或执行：

```powershell
dsh plugin --profile desktop add "D:\projects\DSHCordis\packages\balance"
dsh plugin --profile desktop add "D:\projects\DSHCordis\packages\offpeak"
```

本次余额插件新增宿主 API 查询，升级后必须完全退出并重启客户端。安装结果 application 应为 applied；restart-required 则重启；failed 或 warnings 需要诊断。各包 README 有详细验收步骤。

## 开发检查

不需要 npm install。

```powershell
node scripts/build.mjs
npm test
node scripts/release-check.mjs
npm pack ./packages/balance --dry-run --ignore-scripts
npm pack ./packages/offpeak --dry-run --ignore-scripts
```

两包 src 为客户端源码，lib/client.js 是安装产物；宿主直接使用 ESM。另有 `node scripts/verify-reference.mjs`，依赖 tools/reference 中已下载的官方 SlotCore 0.2.0-rc.2，检查真实注册白名单和标准 props。它不代替真实 React 渲染或 DSH 验收。

`node scripts/verify-rpc-runtime.mjs` 使用 tools/reference/installed 中从本机 DSH 提取的 Cordis、Cosmokit 和 Connection 源码，复现旧 getter 注册错误，并检查新版本启用、认证拒绝分支及卸载。传输层为测试替身，不能替代完整 DSH 端到端验收。

## 测试通过后分发

未发布 npm，未修改 DSH profile。确认本地验收、版本及 @dshcordis scope 权限后：

```powershell
npm publish ./packages/balance --access public
npm publish ./packages/offpeak --access public
```

安装方届时可通过对应包名安装。两个包均无自动发布流程。

设计、接口证据和行为边界见 docs/plugin-design.md；节假日来源见 docs/calendar-sources.md。

## 0.2.0 分发候选

余额查询：工作默认 30 秒（可选 10 秒），非工作默认 5 分钟；设置 → 插件 → 余额查询中调整。空闲时段发送：保留开启后等待并锁定草稿的逻辑；悬停显示今日时段，设置 → 插件 → 空闲时段日历查看月历。两页通过官方 settings.plugins.tab 注册，与插件列表同属插件设置页面。

打包产物位于 dist；发布前完成新版 DSH 本机验收并确认 npm scope 权限。尚未发布 npm。

0.2.1 修复插件列表名称：通过导出的 locale/en.json、locale/zh.json 提供 meta.title 和 meta.description；安装包名保持不变。更新后完全重启 DSH。
