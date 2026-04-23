<div align="center">

# EnvPilot

A Windows-first desktop app for runtime setup, multi-version switching, and environment variable governance.

[简体中文](#简体中文) | [English](#english)

![License](https://img.shields.io/github/license/xiaohaowen21/envpilot?style=flat-square)
![Release](https://img.shields.io/github/v/release/xiaohaowen21/envpilot?style=flat-square)
![Issues](https://img.shields.io/github/issues/xiaohaowen21/envpilot?style=flat-square)
![Stars](https://img.shields.io/github/stars/xiaohaowen21/envpilot?style=flat-square)
![Forks](https://img.shields.io/github/forks/xiaohaowen21/envpilot?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Windows%2010%20%2F%2011-4f6f8f?style=flat-square)
![Stack](https://img.shields.io/badge/stack-Electron%20%2B%20React%20%2B%20TypeScript-58677a?style=flat-square)

</div>

---

## 简体中文

### 项目简介

EnvPilot 是一款面向 Windows 的开发环境管理桌面工具，目标是把“运行时安装、版本切换、环境变量治理、系统能力检测、备份与回滚”放到同一个界面里完成。

它更适合下面这些场景：

- 新电脑开发环境初始化
- 教学机房或培训环境快速部署
- 同一台机器共存多个语言版本
- 清理被污染、重复、失效的 `PATH`
- 管理 `WSL`、`Hyper-V`、`Virtual Machine Platform`、`Docker Desktop`

### 当前定位

当前仓库仍然是一个持续迭代中的早期版本，不适合直接作为生产级运维工具使用，但已经可以用来验证产品方向和核心交互。

- 平台重点：`Windows 10 / 11`
- 技术栈：`Electron + React + TypeScript + Vite`
- 发布形态：Windows 便携版 `exe`
- 当前状态：可测试、可继续开发，但仍存在不少边界问题

在正式测试前，建议先阅读 [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)。

### 当前能力

- 识别机器里已经存在的软件，不要求必须由 EnvPilot 安装
- 托管多版本运行时：`Java`、`Python`、`Node.js`、`Go`、`Rust`、`PHP`
- 支持 Java 发行版选择：`Temurin`、`Oracle`、`Microsoft`
- 通过固定入口目录实现一键切换当前生效版本
- 自动备份环境变量，并在失败时尝试回滚
- 检测和整理 `Path` 中的重复项、空项、失效项、带引号项
- 检测 `WSL`、`Hyper-V`、`Virtual Machine Platform`、`Docker Desktop`
- 支持中英文界面切换

### 当前版本重点

这个版本重点修复了三类问题：

- 改进了运行时安装链路，下载、安装、写入环境变量的阶段更清晰
- 修正了用户级 `PATH` 和系统级 `PATH` 的合并逻辑，避免误伤系统命令
- 重做了主界面布局，让“系统盘点 / 多版本安装 / 变量治理”层级更清楚

### 已知限制

- 仍有一部分安装、卸载和切换场景需要更多真机验证
- 运行时识别和系统软件盘点还不够完美
- 历史日志里可能还会看到早期编码问题留下的异常文本
- 暂未提供签名安装包、正式图标和完整自动发布流水线

详细问题见 [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)，后续计划见 [ROADMAP.md](./ROADMAP.md)。

### 快速开始

#### 直接下载

从 GitHub Releases 下载最新 Windows 便携版：

- `EnvPilot-0.1.0-x64.exe`

#### 本地开发

环境要求：

- `Node.js 20+`
- `Windows PowerShell`

安装依赖：

```bash
npm install
```

启动开发模式：

```bash
npm run dev
```

代码检查与构建：

```bash
npm run lint
npm run build
```

打包 Windows 便携版：

```bash
npm run dist:win
```

### 项目结构

- `electron/`：Electron 主进程与 Windows 侧服务逻辑
- `shared/`：主进程与渲染进程共享类型
- `src/`：React 前端界面
- `public/`：静态资源

### 安全说明

EnvPilot 会在 Windows 上修改运行时目录与环境变量。测试前请注意：

- 先创建备份
- 不要卸载正在被 IDE、终端或后台进程占用的运行时
- 处理系统功能开关时确认是否具备管理员权限

### 文档

- [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)
- [ROADMAP.md](./ROADMAP.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## English

### Overview

EnvPilot is a Windows-first desktop tool that brings runtime installation, version switching, environment variable cleanup, system capability checks, backup, and rollback into one interface.

It is especially useful for:

- bootstrapping a fresh development machine
- preparing teaching labs or training environments
- keeping multiple language versions on one machine
- cleaning a polluted or broken `PATH`
- managing `WSL`, `Hyper-V`, `Virtual Machine Platform`, and `Docker Desktop`

### Current Positioning

This repository is still an actively evolving early-stage project. It is not production-ready yet, but it is already usable for validating the product direction and core workflows.

- Primary platform: `Windows 10 / 11`
- Stack: `Electron + React + TypeScript + Vite`
- Distribution: portable Windows `exe`
- Current state: testable and actively developed, but still rough around the edges

Before testing on a real machine, please read [KNOWN_ISSUES.md](./KNOWN_ISSUES.md).

### What It Can Do Today

- Detect software already present on the machine, even if EnvPilot did not install it
- Manage multiple versions of `Java`, `Python`, `Node.js`, `Go`, `Rust`, and `PHP`
- Support Java vendor selection for `Temurin`, `Oracle`, and `Microsoft`
- Switch active versions through a stable managed entry point
- Back up environment variables before risky changes and attempt rollback on failure
- Scan and clean `Path` issues such as duplicates, empty items, missing entries, and quoted paths
- Detect and manage `WSL`, `Hyper-V`, `Virtual Machine Platform`, and `Docker Desktop`
- Provide bilingual UI switching between Chinese and English

### Highlights In This Release

This release mainly improves three areas:

- clearer runtime install stages across download, install, and environment refresh
- safer `PATH` synchronization between user-level and machine-level entries
- a cleaner UI hierarchy for software inventory, runtime management, and variable governance

### Known Limitations

- several install, uninstall, and switching flows still need more real-machine validation
- runtime detection and software inventory are not fully hardened yet
- some historical logs may still contain garbled text from early encoding issues
- there is no signed installer, polished icon set, or full release automation yet

For details, see [KNOWN_ISSUES.md](./KNOWN_ISSUES.md). For next steps, see [ROADMAP.md](./ROADMAP.md).

### Quick Start

#### Download

Download the latest Windows portable build from GitHub Releases:

- `EnvPilot-0.1.0-x64.exe`

#### Local Development

Requirements:

- `Node.js 20+`
- `Windows PowerShell`

Install dependencies:

```bash
npm install
```

Start development mode:

```bash
npm run dev
```

Validate and build:

```bash
npm run lint
npm run build
```

Build the Windows portable executable:

```bash
npm run dist:win
```

### Repository Structure

- `electron/`: Electron main process and Windows-side service logic
- `shared/`: shared contracts between main and renderer
- `src/`: React UI
- `public/`: static assets

### Safety Notes

EnvPilot changes runtime directories and environment variables on Windows. Before testing:

- create a backup first
- do not uninstall runtimes that are currently used by IDEs, terminals, or background processes
- verify administrator rights before touching Windows feature switches

### Documentation

- [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)
- [ROADMAP.md](./ROADMAP.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

[MIT](./LICENSE)
