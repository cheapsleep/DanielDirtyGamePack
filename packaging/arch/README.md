Daniel's Dirty Game Pack - Arch packaging (wrap AppImage)

This folder contains a simple PKGBUILD that wraps the AppImage produced by the Tauri AppImage build.

How it works (Option A):

1. CI builds the AppImage artifact via existing `build-linux` job.
2. The `build-arch` job downloads the AppImage.
3. The PKGBUILD installs the AppImage into `/opt/daniels-dirty-game-pack/` and creates a `/usr/bin` wrapper and desktop entry.

To test locally:

- Place the AppImage alongside this PKGBUILD and run `makepkg` in this directory (requires `base-devel` and `fakeroot`).
- Install the produced `.pkg.tar.zst` with `sudo pacman -U <package>.pkg.tar.zst`.

Notes:
- For production packaging you may want to extract icons from the AppImage and package them into the proper icon directory.
- Consider adding a `.install` script to update desktop icon caches on install/uninstall.
