# Contributing

Thanks for helping improve EnvPilot.

## Before You Start

- Read [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)
- Keep pull requests focused and small
- Prefer bug fixes and stabilization over broad feature expansion

## Local Setup

```bash
npm install
npm run dev
```

## Validation

Please run these before opening a pull request:

```bash
npm run lint
npm run build
```

## Guidelines

- Do not commit build artifacts such as `dist/`, `dist-electron/`, or `release/`
- Be careful with code that edits system environment variables
- Prefer clear, minimal changes over large rewrites
- Document user-visible limitations honestly
