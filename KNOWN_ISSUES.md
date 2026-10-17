# Known Issues

- **Installs from 0.1.x are not migrated.** 0.2 keeps runtimes in a new layout under `%LOCALAPPDATA%\EnvPilot`. Uninstall old runtimes with 0.1, or delete the old folder and remove its entries from PATH (the PATH check-up will flag them as missing).
- **Install flows are verified by CI only in part.** The Windows CI job tests registry reads and writes, elevation, junctions and zip extraction on a real runner, but does not download and install every runtime. Rust (via rustup) and Python (via the official NuGet package) have had the least real-world use.
- **Python comes from the NuGet distribution.** It has no `py` launcher and does not register itself with Windows, which is what lets several versions live side by side.
- **Oracle JDK** is offered only for the releases Oracle publishes as "latest" under its free licence (currently 21 and 25).
- **Programs that were already open** (including some IDEs) keep their old environment until restarted. New terminals see changes immediately.
- **Unsigned builds** may trigger a SmartScreen warning on first launch.
