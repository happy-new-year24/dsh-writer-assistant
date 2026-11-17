# dsh-writer-assistant

[English](#english) | 中文

把本机「作家助手」（阅文作者客户端）接进 DeepSeek Harness：每天自动签到、一键新建草稿、用使用量最高的大纲起书、浏览阅创学堂的写作技巧。

A DSH bundle that drives the local **作家助手** (Yuewen author client) over the Chromium DevTools Protocol: daily check-in, draft creation, the most-used outline template, and writing-technique articles.

> 只在 Windows 上验证过（本插件按 Windows 路径与进程名实现）。

---

## 它是什么

DSH 侧边栏多一个「作家助手」入口，主区是一个四标签面板：

| 标签 | 内容 |
| --- | --- |
| **创作** | 填书名/简介新建私密草稿（可带大纲），列出并打开自己的作品 |
| **灵感** | 随机灵感抽签 + 阅创学堂文章（按写作技巧/剧情设计/人物设定/开篇创作等分类） |
| **大纲** | 读取模板中心「总纲」使用量排行，一键用使用量最高的大纲新建草稿 |
| **我的** | 今日签到、任务进度、每日自动签到开关与执行时间、全部功能入口、连接信息与重启 |

## 它怎么工作

不注入客户端、不保存账号密码、不改作家助手任何文件。

Host 半侧在启动/连接作家助手时带上：

```
--remote-debugging-port=9222
```

随后通过 `http://127.0.0.1:9222` 的 CDP 操作**已经登录**的页面：

- **签到**：只点文字正好是「签到」的按钮。永远不点「补签」（补签会消耗墨水，且失败会弹「墨水不足」）。
- **建草稿**：走原生 UI 流程——模板中心「应用于新建书籍」，或首页「新建 → 私密作品」。表单用原生 `value` setter 加 `input`/`change` 事件写入，和真人输入等价。
- **大纲**：解析卡片上的 `N使用`，按数值排序取最高。
- **写作技巧**：打开阅创学堂 `https://write.qq.com/portal/article`，按 `label1` 分类抓文章链接。

调试端口只绑 `127.0.0.1`；面板接口走 DSH 自带的浏览器信任栅栏（`connection.requestRejection`）。

### 为什么用 CDP 而不是调接口

作家助手的业务接口需要签名参数和会话票据，逆向那套东西既不稳定也越界。CDP 复用客户端自己的登录态，只做「人本来会做的点击」，客户端改版只影响选择器，不影响账号安全。

## 安装

DSH Desktop 里 **设置 → 插件**，搜索 `dsh-writer-assistant` 安装；或命令行：

```sh
dsh plugin --profile <profile> add dsh-writer-assistant
```

装好后侧边栏出现「作家助手」，主区多一个同名面板。

## 第一次使用

1. 正常打开一次作家助手，确认已登录、能进首页。
2. 面板点「启动并连接」。
   - 没启动：DSH 带调试端口帮你启动。
   - 已启动但没有调试端口：面板提示「需要重启才能连接」。**先保存正在写的内容**，再点「重启并连接」。
3. 连接成功后，「我的」显示账号、今日签到状态、任务进度。

## 每日自动签到

默认开启，09:00 执行，可在「我的」改开关和时间。

- 需要 DSH 正在运行；DSH 关闭时不会在后台签到。
- 到点后作家助手没开，会自动启动它。
- 当天已签到则跳过，同一天不会重复点。
- 只点「签到」，不点「补签」。

## 配置

`~/.dsh/writer-assistant.json`：

```json
{
  "autoCheckin": true,
  "checkinHour": 9,
  "lastCheckin": "2026-11-17",
  "port": 9222,
  "appPath": "D:\\作家助手\\yuewenedit\\program\\yuewenedit.exe"
}
```

面板里的开关与时间会写回这里。删掉该文件即恢复默认。

## 需要注意

- 作家助手升级后页面结构可能变化。找不到按钮时面板会明确报错，绝不盲点。
- 「重启并连接」会关闭作家助手进程，未保存的正文/大纲可能丢失，所以有二次确认。
- 只读取首页作品列表、签到状态、模板中心卡片和公开的阅创学堂文章，**不读取作品正文**。
- 不采集遥测；除 `127.0.0.1:9222` 与公开的阅创学堂页面外无网络请求。
- 调试端口默认 `9222`，被占用时改 `port`。

## HTTP 接口

Host 半侧注册 `POST /writer-assistant/api`：

```json
{ "action": "status" }
{ "action": "checkin" }
{ "action": "topOutlines" }
{ "action": "createDraft", "title": "书名", "synopsis": "简介", "useOutline": true, "outlineTitle": "组织群像总纲" }
{ "action": "listTips", "category": "写作技巧" }
{ "action": "listWorks" }
{ "action": "openFeature", "label": "任务中心" }
{ "action": "restart" }
```

返回 `{ "ok": true, "data": ... }` 或 `{ "ok": false, "error": "..." }`。

## 许可

MIT

---

## English

A DeepSeek Harness bundle that controls the local **作家助手** (Yuewen's Windows author client) over the Chromium DevTools Protocol, so you can check in, create drafts, apply the most-used outline template, and read writing-technique articles without leaving DSH.

**Four tabs:** 创作 (create drafts, list works) · 灵感 (idea prompts, technique articles) · 大纲 (outline template leaderboard) · 我的 (check-in, task progress, auto check-in, quick links, connection info).

**How it works:** the host half launches or attaches to the client with `--remote-debugging-port=9222` (loopback only) and drives the page you are already signed into. It never stores credentials, never modifies the client, and never clicks 补签 (the ink-costing make-up check-in) — only the plain 签到 button.

**Requirements:** Windows; the 作家助手 client installed; DSH Desktop. If the client is already running without the debug port, the panel asks before restarting it, because unsaved chapter text could be lost.

**Install:** `dsh plugin --profile <profile> add dsh-writer-assistant`

**Config:** `~/.dsh/writer-assistant.json` (`autoCheckin`, `checkinHour`, `port`, `appPath`).

**Privacy:** no telemetry; the only outbound requests are to `127.0.0.1:9222` and the public `write.qq.com` article portal. Manuscript text is never read.

MIT licensed.
