# DSHCordis

<img src="./packages/balance/icon.svg" width="64" height="64" alt="余额查询图标"> <img src="./packages/offpeak/icon.svg" width="64" height="64" alt="空闲时段发送图标">

两个用于 DeepSeek Harness（DSH）的插件：余额查询、空闲时段发送。当前源码版本为 **0.2.2**（新增插件图标，发布后可安装），开发接口参考 DSH **0.2.0-rc.2**。

| 插件名称 | npm 包名 | 功能 |
| --- | --- | --- |
| [余额查询](./packages/balance/README.md) | [@liming999/balance](https://www.npmjs.com/package/@liming999/balance) | 在底边栏显示余额，可配置工作与非工作时的查询频率 |
| [空闲时段发送](./packages/offpeak/README.md) | [@liming999/offpeak](https://www.npmjs.com/package/@liming999/offpeak) | 等待空闲时段发送草稿，提供今日时段提示和空闲日历 |

## 在 DSH 插件界面安装

打开 DSH 插件管理中的安装入口，在“填入插件 npm 包名”处输入以下内容，分别安装。

**余额查询：**

```text
@liming999/balance
```

**空闲时段发送：**

```text
@liming999/offpeak
```

输入框只填写包名，不填写 `npm install`、`dsh plugin add` 或网页链接。安装后完全退出并重启 DSH；中文插件列表显示“余额查询”和“空闲时段发送”。

如果之前安装过旧名称 `@dshcordis/balance` 或 `@dshcordis/offpeak`，先在插件管理器中移除旧包，再安装新包，避免重复注册。

## 使用命令行安装

使用 DSH Desktop 的 `desktop` profile 时，在终端执行：

```powershell
dsh plugin --profile desktop add @liming999/balance
dsh plugin --profile desktop add @liming999/offpeak
```

其他 profile 请将 `desktop` 替换为实际名称。安装或更新后完全退出并重启 DSH；如果出现 warnings 或启用失败，应先处理错误。

## 余额查询

- 在输入框底边栏显示余额，点击可查看总余额、赠送余额和充值余额。
- 支持 DeepSeek API Key 和登录账户；API Key 模式不要求登录，自动模式优先使用 API Key。
- 任一会话的 Agent 工作时默认每 **30 秒**查询，否则默认每 **5 分钟**查询。
- 在 **设置 → 插件 → 余额查询** 中调整频率，工作时支持 **10 秒**查询。
- 配置保存在当前浏览器，同源窗口同步。非官方代理地址不支持 API Key 余额查询。

详细说明见 [余额查询 README](./packages/balance/README.md)。

## 空闲时段发送

先关闭开关编辑草稿，再开启开关。高峰时段会暂停编辑并显示倒计时；进入空闲时段后自动提交一次当前非空草稿。关闭开关可取消等待并恢复编辑。当前为空闲时段时，仍由用户正常提交。

按北京时间判断：

| 日期类型 | 空闲时段 |
| --- | --- |
| 工作日，包括调休工作日 | 00:00–09:00、12:00–14:00、18:00–24:00 |
| 节假日和休息日 | 全天 |

鼠标悬停开关可查看今日空闲时段；在 **设置 → 插件 → 空闲时段日历** 中查看月历。内置 2024–2026 年节假日安排，未收录年份按普通工作日近似判断并显示提示。

插件不是后台定时任务，退出 DSH 后不会发送。切换会话、隐藏页面、关闭开关或状态读取失败会取消当前等待；会话运行中不自动排队。该规则不查询实时价格，实际费用以服务商计费为准。

详细说明见 [空闲时段发送 README](./packages/offpeak/README.md)。

## 仓库内容

`packages/balance` 和 `packages/offpeak` 包含插件源码、已构建的 `lib`、语言文件和安装声明。npm 包包含预构建代码，用户安装时不需要自行构建。本仓库公开内容以插件包和使用说明为主。

两个插件均使用 MIT 许可证，详见各包的 LICENSE。
