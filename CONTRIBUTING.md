# Contributing

Thanks for helping improve EnvPilot.

## Setup

```bash
npm install
npm run dev            # Electron, on Windows
npm run dev:renderer   # UI only with sample data, on any OS
```

## Before opening a pull request

```bash
npm run check   # lint, tests and build
```

## Guidelines

- Keep system-independent logic in `electron/core` and cover it with tests; keep side effects in `electron/platform`.
- Every change to environment variables goes through `services/environment.ts#apply`, which snapshots first.
- Never flatten `%VAR%` references or change a registry value's type.
- User-facing text lives in `src/locales`; add both languages.
- Don't commit `dist/`, `dist-electron/` or `release/`.
