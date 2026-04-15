# Known Issues

This list is intentionally blunt. The project still has many unresolved problems.

## Core Runtime Management

- Uninstall can fail when a runtime is still being used by another process.
- Some runtime install, switch, and cleanup flows still need stronger rollback behavior.
- Runtime metadata and system-installed tool detection are not fully trustworthy yet.
- Java vendor support exists, but downstream tool recognition still needs more validation.

## Environment Variables

- Environment variable cleanup rules are still conservative and incomplete.
- Old operation logs may contain garbled historical text from earlier encoding problems.
- More guardrails are needed before changing machine-level settings.

## Platform Features

- WSL, Hyper-V, Virtual Machine Platform, and Docker handling still needs clearer semantics and more testing.
- “Disable” versus “uninstall” behavior needs more UX refinement.

## UI / UX

- The current UI is still inconsistent across modules.
- Layout density, hierarchy, and card interactions need another design pass.
- Internationalization coverage is incomplete.

## Packaging / Release

- Portable build packaging works, but release validation is still shallow.
- No application icon, signed build, or polished GitHub release pipeline yet.

## Engineering Quality

- Automated test coverage is still missing.
- There is no persistent regression suite for install / uninstall flows.
- The codebase needs cleanup, simplification, and clearer module boundaries.
