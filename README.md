# EnvPilot

Windows-first desktop app for runtime setup and environment variable governance.

## Status

This repository is currently an early MVP.

- Platform focus: `Windows 10/11`
- Stack: `Electron + React + TypeScript + Vite`
- Current state: usable for exploration, not stable enough for production

If you are evaluating the project, please read [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) first.

## What It Tries To Solve

EnvPilot aims to make developer environment setup less painful by handling:

- runtime detection
- multi-version runtime management
- environment variable cleanup and repair
- WSL / Hyper-V / virtualization capability checks
- backup and rollback before risky operations

## Current Capabilities

- Detects existing tools on the machine, including software not installed by EnvPilot
- Manages multiple runtime versions for `Java`, `Python`, `Node.js`, `Go`, `Rust`, and `PHP`
- Supports Java vendor selection for `Temurin`, `Oracle`, and `Microsoft`
- Creates backups before environment mutations
- Scans `Path` issues such as duplicates, empty items, invalid paths, and quoted entries
- Provides a bilingual UI with Chinese and English switching
- Packages a Windows portable build with `electron-builder`

## Current Limitations

- There are still many functional bugs and UX inconsistencies
- Some install / uninstall flows are not yet reliable
- Runtime detection, environment mutation, and packaging still need hardening
- The project is not yet ready for enterprise or classroom deployment

More detail: [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)

## Development

Requirements:

- Node.js 20+
- Windows PowerShell

Install dependencies:

```bash
npm install
```

Start development mode:

```bash
npm run dev
```

Validate:

```bash
npm run lint
npm run build
```

Build Windows portable executable:

```bash
npm run dist:win
```

## Repository Structure

- `electron/`: Electron main process and Windows service logic
- `shared/`: shared contracts between main and renderer
- `src/`: React UI
- `public/`: static assets

## Documentation

- [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)
- [ROADMAP.md](./ROADMAP.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)

## Safety Note

This project changes runtime directories and environment variables on Windows.

Before testing on a real machine, make sure you:

- create backups
- avoid uninstalling runtimes that are currently in use
- verify admin permissions when touching system features

## License

[MIT](./LICENSE)
