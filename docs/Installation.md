# 📦 StreamGo Installation Guide

This guide provides instructions for installing StreamGo on various platforms.

## 🐧 Linux

### Debian / Ubuntu

For Debian, Ubuntu, and other Debian-based distributions, you can install StreamGo using the `.deb` package.

1.  **Download** the latest `_amd64.deb` file from the [GitHub Releases](https://github.com/GeneticxCln/StreamGo/releases) page.
2.  **Install** the package using the `dpkg` command:

```bash
sudo dpkg -i StreamGo_*.deb
```

If you encounter any dependency issues, run the following command to fix them:

```bash
sudo apt-get install -f
```

### Arch Linux

Currently, the AppImage bundle for Arch Linux may fail to build due to a `linuxdeploy` error, potentially related to system-specific configurations of the `webkit2gtk-4.1` package.

**Recommended Installation:**

*   **From source**: The most reliable method is to build the application from source. Follow the instructions in the [README.md](https://github.com/GeneticxCln/StreamGo/blob/main/README.md#%EF%B8%8F-development) file.
*   **Using the `.deb` package**: You can use a tool like `debtap` to convert the `.deb` package to an Arch Linux package.

### Other Linux Distributions (Fedora, etc.)

For other distributions, you can use the `.rpm` package if available on the releases page, or build from source.

## 🍎 macOS

1.  **Download** the latest `.dmg` file from the [GitHub Releases](https://github.com/GeneticxCln/StreamGo/releases) page.
2.  **Open** the `.dmg` file.
3.  **Drag** the `StreamGo.app` icon into your `Applications` folder.

## 🪟 Windows

1.  **Download** the latest `.msi` installer from the [GitHub Releases](https://github.com/GeneticxCln/StreamGo/releases) page.
2.  **Run** the installer and follow the on-screen instructions.
