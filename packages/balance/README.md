# 余额查询

本地测试版 `@dshcordis/balance@0.2.1`，接口参考 DSH 0.2.0-rc.2。

在插件管理器安装 `D:\projects\DSHCordis\packages\balance`，或：

```powershell
dsh plugin --profile desktop add "D:\projects\DSHCordis\packages\balance"
```

本次新增宿主查询逻辑，升级后必须完全退出并重启 DSH。检查安装结果的 application 和 warnings。

输入框下方显示多币种余额；点击向上展开赠送、充值和总余额，点击外部或 Esc 关闭。弹层可以选择「自动（优先 API Key）」「API Key」「登录账户」，并显示当前来源。选择只在当前插件生命周期内保留，不跟随会话模型自动切换。

API Key 模式不要求登录。宿主通过官方 deepseek-official 提供方的 settingsNs/settingsPath 找到 apiKeyEnv，再用 credentials.resolve 解析；无提供方描述时使用 DEEPSEEK_API_KEY。没有 credentials 服务时沿用启动环境。只向 https://api.deepseek.com/user/balance 发送凭证且拒绝重定向；Key 不返回客户端、不记录日志。非官方代理地址不支持查询，避免把代理 Key 发给官方。自动模式无 Key 或不支持时才回退登录账户；Key 无效或网络失败会明确显示错误。

充值只跳转 platform.deepseek.com 的 HTTPS 页面，不处理支付。[官方 API 余额接口](https://api-docs.deepseek.com/zh-cn/api/get-user-balance/)返回总额、赠金与充值余额，插件保留其精度。

登录账户模式继续复用官方 account Remote。按钮挂载时查询一次；会话列表中任一 Agent 运行时默认每 30 秒查询，否则默认每 5 分钟查询。多个实例共享插件内的刷新与进行中请求，普通读取有 10 秒缓存，定时刷新绕过缓存。查询用量按钮重新读取余额并绕过插件缓存，无法保证绕过服务端缓存。设置页和插件的读取时间可能不同。

账户钱包使用精确十进制加法，至少保留两位，更多精度不截断。最后读取时间不是账单结算时间。未配置、未登录、不支持、Key 无效及不可用分别显示，不把失败显示成零余额。

## 验收

1. 退出登录但保留 DeepSeek API Key，自动和 API Key 模式应显示余额，不应弹出登录要求。
2. 同时配置登录账户和 API Key，分别选择来源，对比对应账户的余额；确认自动模式优先 API Key。
3. 测试自定义 apiKeyEnv、错误 Key、删除 Key、非官方代理配置；不得把错误显示成零。
4. 弹层内操作不关闭，外部点击与 Esc 关闭。观察运行时 30 秒、非运行时 5 分钟及手动刷新。
5. 断网后显示不可用，恢复后重查；测试明暗主题、多会话和禁用再启用，无重复项。
6. 充值只在浏览器打开官方页面，不执行支付。

源码在 src，修改后在仓库根运行 `node scripts/build.mjs`。宿主入口或 API 模块更改需完全重启。

本地验收通过后再发布，当前未执行 npm publish。发布前确认拥有 @dshcordis scope 权限；更换包名需同时修改补丁、构建脚本和模块 ID。

## 查询频率配置

进入「设置 → 插件 → 余额查询」：工作频率可选 10/30/60/120/300 秒，非工作频率可选 1/5/10/30/60 分钟。设置立即生效，保存于当前浏览器 localStorage，同源窗口同步；不同浏览器不共享。没有挂载余额按钮时不轮询。窗口隐藏仍由浏览器定时器调度，可能被后台限速。切换工作状态按上次查询时间重新判断是否到期。

公开分发包名仍为 `@dshcordis/balance`；显示名称为「余额查询」。

0.2.1 修复插件列表名称：通过导出的 locale/en.json、locale/zh.json 提供 meta.title 和 meta.description；安装包名保持不变。更新后完全重启 DSH。
