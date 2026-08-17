# dsh-ssh-bridge

**ZCode 风格的 SSH 远程开发插件，为本地部署的 DeepSeek Harness（DSH web）而做。**

一键向导创建远程工作区 → 左侧工作区列表出现远程服务器 → 在里面开的会话自动就是远程会话（bash / 文件读写 / 搜索透明地在服务器上执行）→ 侧边栏文件浏览器直接显示远程目录树。

```
DSH 会话 ──tools/execute 桥──▶ SSH 引擎 ──▶ 远程服务器（只需 sshd，零足迹）
     ▲                                   │
     └──── better-sidebar 文件浏览器 ◀───┘
```

## 功能总览

| 能力 | 说明 |
|---|---|
| **远程工作区向导** | 侧边栏「＋ 远程」→ 选择主机 → 连接（实时日志）→ 选择目录 → 创建工作区。左侧出现 `gpu01 · /home/dev/project` 这样的远程工作区，与本地工作区同款交互 |
| **会话自动远程** | 在远程工作区里建的会话，`bash`（含持久 shell 变体）/ `read` / `write` / `edit` / `str_replace_editor` / `glob` / `grep` 全部透明转发到远程目录执行——模型照常用它熟悉的工具，零学习成本，diff/行号/卡片渲染完全原生 |
| **远程文件浏览器** | 面包屑导航 / 在线编辑保存 / 新建·重命名·删除 / 上传（进度）/ 下载 / 设为工作区 |
| **远程终端** | xterm.js + WebSocket PTY |
| **主机管理** | `~/.ssh/config` 别名自动填充与一键导入、密码/私钥+口令认证、ProxyJump 跳板链、连接状态与最近工作区 |
| **凭证安全** | 密码/口令只进 DSH 官方凭证库（`~/.dsh/.credentials.yaml`，owner-only），配置 JSON 永不落密；HTTP/WS 路由 loopback-only 围栏 |
| **审计日志** | `~/.dsh/remote-ssh/audit.jsonl` 记录每次远程执行/写入/删除/连接（命令、退出码、耗时；不记内容不记密钥），5MB 自动轮转 |
| **搜索优化** | 远程 grep 优先用 ripgrep（按主机探测一次并缓存），无 rg 自动回退 `grep -rnE` |
| **输出治理** | 超大命令输出保留 60% 头 + 40% 尾并标注截断字节数，不丢尾部报错 |
| **旧数据迁移** | 首次启动自动把市场版 dsh-ssh 的主机配置（含明文密码）迁入新存储与凭证库 |

## 安装

```sh
# 方式一：从 GitHub 安装（lib/ 已提交，无需构建）
dsh plugin --profile <你的profile> add github:<你的用户名>/dsh-ssh-bridge
dsh web   # 重启生效

# 方式二：本地开发
git clone https://github.com/<你的用户名>/dsh-ssh-bridge && cd dsh-ssh-bridge
pnpm install && pnpm build
dsh plugin --profile <你的profile> add link:$(pwd)
```

## 使用

### 远程工作区（推荐）

1. 侧边栏「＋ 远程」→ 向导三步：选主机 → 连接 → 选目录。
2. 左侧出现远程工作区，点它的「New session」开会话——**自动远程**，直接对 Agent 说“跑下测试”、“改一下 xx 文件”。
3. 底部 better-sidebar 文件浏览器显示**远程目录树**（需打一次桥接补丁，见下）。

### 管理面板

向导里点「取消」进入主机管理页：新增/编辑/删除主机、导入 `~/.ssh/config`、连接后浏览文件/开终端、把已有会话手动绑定到远程（解绑即回本地）。

## better-sidebar 桥接补丁（远程文件树）

dsh-better-sidebar 的文件浏览器只认本地文件系统。补丁让它在会话 cwd 是远程工作区时改走 SSH：

```sh
node scripts/patch-better-sidebar.mjs            # 打补丁（src + lib，幂等）
node scripts/patch-better-sidebar.mjs --revert   # 还原
# 重启 dsh web 生效；better-sidebar 每次升级后需重跑
```

补丁只按需转发 `fs.tree / fs.read / fs.write`（非远程路径零改动），git 面板仍走本地。

## 与 ZCode 远程开发的差异（插件层架构所限）

- DSH 会话进程跑在本机，本插件通过工具分发层把会话操作转发远程——效果等价于 ZCode 的“Agent 在远端干活”，但左侧工作区标签对应的本地路径是标记目录；
- ZCode 的“配置同步（Skill/MCP 推到远端）”需要 harness 级支持，插件层不做；
- 远程会话中 `read_image` 与 bash 后台任务不可用（会收到明确报错）。

## 架构与排障

```
src/
  index.ts           # 插件装配：settings 区段、引擎、路由、工具、远程会话监听、系统提示、旧数据迁移
  protocol.ts        # host/client 共享纯类型 + 路由常量 + withCwd
  secrets.ts         # 凭证库适配器（DSH_REMOTE_SSH_* 引用）
  store.ts           # 主机/最近工作区/会话绑定存储、~/.ssh/config 解析与导入、旧插件迁移
  engine.ts          # ssh2 连接池（SFTP 通道用完即关）、exec、PTY、文件操作、连接日志、审计、命令探测
  routes.ts          # /api/remote-ssh/* 路由族 + 终端 WebSocket 升级
  tools.ts           # Agent 显式工具（ssh_list/exec/list_dir/read_file/write_file/upload/download）
  remote-session.ts  # 远程会话：tools/execute 拦截，按原工具 schema 自适应返回
  workspace-marker.ts# 远程工作区标记目录（会话 cwd → 远程绑定自动解析）
  sidebar-bridge.ts  # better-sidebar 文件桥（globalThis 通道）
  client/            # 浏览器半区：向导、Dock 面板、入口、API 封装
```

关键机制：

- **远程工作区 = 标记目录**：`~/.dsh/remote-ssh/ws/<alias>_<dir>/marker.json` 记录 `{alias, dir}`；会话 cwd 落在标记目录内 → `tools/execute` 按 `Session.header.cwd` 动态解析远程绑定（子代理同样覆盖）。
- **SFTP 通道卫生**：每次操作开新通道、用完即关。sshd `MaxSessions`（默认 10）限制单连接并发通道，泄漏会累积到 `Channel open failure: open failed`；通道级失败自动标记连接损坏并重连重试。
- **双 bash 变体**：dsh-base 同时装配 dsh-tool-bash（结构化输出）与 dsh-tool-bash-persistent（字符串输出）；拦截器运行时查询实际注册变体的 schema 自适应。
- **直连 harness RPC**：向导通过 `POST /api/workspace.create|workspace.rename|session.create`（信封 `{type:'client-request', rpcId, method, payload}`）创建工作区与会话。

## 致谢

工程设计参考了社区里成熟 SSH 工具的实践：[mcp-ssh-manager](https://github.com/bvisible/mcp-ssh-manager)（审计日志、输出治理、策略层思想）与 [opencode-remote-code](https://github.com/zz6zz666/opencode-remote-code)（rg 回退链、透明工具覆盖）。终端使用 [xterm.js](https://github.com/xtermjs/xterm.js)（MIT），SSH 使用 [ssh2](https://github.com/mscdex/ssh2)（MIT）。

## License

MIT
