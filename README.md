<div align="center">

<img src="public/favicon.svg" width="64" height="64" alt="" />

# EnvPilot

在 Windows 上安装、切换多个版本的 Java / Node.js / Python / Go / Rust / PHP，并让 PATH 保持干净。

Install and switch Java, Node.js, Python, Go, Rust and PHP versions on Windows, and keep PATH healthy.

[简体中文](#简体中文) · [English](#english)

![EnvPilot](docs/screenshot.png)

</div>

## 简体中文

### 它做什么

- **多版本运行时**：从官方源下载并校验（有校验和的都会校验），装在 `%LOCALAPPDATA%\EnvPilot`，不需要管理员权限。
- **一键切换**：每个运行时都有一个固定入口 `links\<名称>`，PATH 和 `JAVA_HOME` 只指向它。切换版本只是改这个入口，不改环境变量，新开的终端立即生效。
- **告诉你终端里实际用的是哪个**：如果系统 PATH 里有别的 `java.exe` 排在前面（比如 Oracle 安装器留下的 `javapath`），会直接指出来，并可以一键移除。
- **PATH 体检**：找出空项、重复项、不存在的目录和多余引号；可能在未插入的磁盘上的路径不会被默认删除。逐项勾选后再整理。
- **快照**：每次修改环境变量前自动保存，可以对比差异并恢复。

### 安全原则

- 读写注册表时保留原始值和类型（`REG_EXPAND_SZ`），不会把 `%USERPROFILE%` 之类的引用写死成绝对路径。
- 只有涉及系统级变量时才请求管理员权限，由 Windows 弹出 UAC 确认。
- Windows 目录下的 PATH 项永远不会被提议删除。
- 所有修改先保存快照，再一次性写入。

### 使用

到 [Releases](https://github.com/xiaohaowen21/envpilot/releases) 下载安装版或便携版。需要 Windows 10 1803 或更新版本。

### 开发

```bash
npm install
npm run dev            # Electron 开发模式（需要 Windows）
npm run dev:renderer   # 只启动界面，在任意系统的浏览器里用示例数据预览
npm run check          # lint + 测试 + 构建
npm run dist:win       # 打包安装版和便携版
```

代码结构：

| 目录 | 内容 |
| --- | --- |
| `electron/core` | 纯逻辑：PATH 解析、命令解析顺序、变更计划、版本目录解析。全部有单元测试。 |
| `electron/platform` | 和 Windows 打交道的部分：注册表、PowerShell、junction、解压。 |
| `electron/services` | 把上面两层组合成具体功能：安装、切换、快照、设置。 |
| `electron/ipc.ts` | 所有 IPC 通道，入参用 zod 校验，修改类操作串行执行。 |
| `shared` | 主进程和界面共用的类型与 API 定义。 |
| `src` | React 界面，按页面拆分。 |

---

## English

### What it does

- **Multiple runtime versions**: downloaded from official sources, verified against published checksums, and installed under `%LOCALAPPDATA%\EnvPilot` without administrator rights.
- **One-click switching**: each runtime has a stable junction, `links\<name>`, that PATH and `JAVA_HOME` point at. Switching only retargets the junction, so environment variables never change and new terminals pick it up at once.
- **Shows what your terminal really runs**: if another `java.exe` comes first on the system PATH (such as Oracle's `javapath`), EnvPilot says so and can remove it.
- **PATH check-up**: finds empty, duplicate, missing and quoted entries. Entries it can't verify (an unplugged drive, an undefined variable) are never removed by default. You pick what to fix.
- **Snapshots**: taken automatically before every change, with a diff view and restore.

### Safety

- Registry values are read and written raw and keep their type (`REG_EXPAND_SZ`), so references like `%USERPROFILE%` are never flattened into absolute paths.
- Administrator rights are requested through UAC only when system variables change.
- PATH entries inside the Windows folder are never offered for removal.
- Every change is snapshotted first, then written in a single step.

### Install

Download the installer or the portable build from [Releases](https://github.com/xiaohaowen21/envpilot/releases). Requires Windows 10 1803 or later.

### Develop

```bash
npm install
npm run dev            # Electron in development mode (Windows)
npm run dev:renderer   # UI only, with sample data, in any browser on any OS
npm run check          # lint + tests + build
npm run dist:win       # build the installer and the portable app
```

See the table above for how the code is organised. Known limitations are listed in [KNOWN_ISSUES.md](./KNOWN_ISSUES.md).

## License

[MIT](./LICENSE)
