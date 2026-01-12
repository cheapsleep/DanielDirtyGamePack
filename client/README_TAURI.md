Tauri Desktop Build (Windows & Linux)

This document explains how to build and how CI is configured.

Requirements (local)
- Node.js 18+ (used in project)
- Rust toolchain (stable) installed via rustup: https://rustup.rs/
- On Linux: system packages (example for Debian/Ubuntu):
  sudo apt-get install -y libwebkit2gtk-4.0-dev libssl-dev build-essential pkg-config curl
- On Windows: Visual Studio Build Tools (MSVC) / Desktop development workload.

Local development
1. Install Node deps:

```bash
cd client
npm install
```

2. Run the Vite dev server and open a Tauri window (requires `tauri` CLI):

```bash
# start Vite dev server
npm run dev

# in another shell, run Tauri dev (will open a native window pointing at the dev server)
npm run tauri:dev
```

Build (production)

```bash
cd client
# Build web assets
npm run build
# Build native bundles (AppImage/DEB on Linux, MSI on Windows)
npm run tauri:build
```

Artifacts are produced under `client/target/release/bundle` (or `client/src-tauri/target/release/bundle`) depending on Tauri version.

CI (GitHub Actions)
- A workflow `./github/workflows/tauri-build.yml` is included to produce Linux (AppImage/DEB) and Windows (MSI) bundles.
- The runner installs Node and Rust, builds web assets, then runs `npx tauri build`.

Notes & Troubleshooting
- If the CI build fails on macOS or Windows due to missing native toolchains, install the required build tools or adjust the workflow.
- For Tauri >=2, the build may require specific native libraries on Linux (`libwebkit2gtk`). The workflow installs these for Ubuntu.
- The app expects to reach your game server; configure server URL via environment variables or build-time config (e.g., `VITE_PUBLIC_SERVER_URL`).

Security
- The example `tauri.conf.json` uses `allowlist.all=true` for convenience during development. Audit and restrict enabled APIs for production.

If you want, I can:
- Add GitHub Action steps to sign Windows MSI (requires secrets)
- Add macOS build job
- Add release tagging and automatic upload to GitHub Releases
