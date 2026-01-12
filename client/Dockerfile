FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates curl build-essential git pkg-config wget gnupg2 dirmngr \
  libssl-dev libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev libnotify-dev \
  librsvg2-dev \
  libfuse2 python3 python3-pip xz-utils unzip ca-certificates file \
  && rm -rf /var/lib/apt/lists/*

# Install Node 18 from NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
  apt-get install -y --no-install-recommends nodejs && rm -rf /var/lib/apt/lists/*

# Install Rust (rustup)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Tauri CLI
RUN npm install -g @tauri-apps/cli@^2.9.6

WORKDIR /home/tauri

# Copy the client folder contents (build context is `client/`) into /home/tauri/repo
COPY . /home/tauri/repo

# Use the copied repo root as the build workspace so `npm` and `tauri` find
# `package.json` and `src-tauri` correctly.
WORKDIR /home/tauri/repo

# Install JS deps and build frontend (from repo root where package.json lives)
RUN npm install && npm run build

# Ensure Tauri picks up the built frontend when running inside Docker
ENV TAURI_DIST_DIR=/home/tauri/repo/dist
ENV TAURI_DEV_PATH=http://localhost:5173
ENV CARGO_TARGET_DIR=/home/tauri/repo/target

# Make our AppRun wrapper executable so linuxdeploy/appimagetool can use it
RUN if [ -f src-tauri/bundle/appimage/AppRun ]; then chmod +x src-tauri/bundle/appimage/AppRun || true; fi

# Build Tauri bundle (AppImage) from the repo root
RUN npx tauri build --verbose

# Final artifacts will be in /home/tauri/repo/target/release/bundle
