<div align="center">

# 🎬 StreamGo

### Modern Cross-Platform Media Center

[![Rust](https://img.shields.io/badge/rust-1.77.2+-orange.svg)](https://www.rust-lang.org)
[![Tauri](https://img.shields.io/badge/tauri-2.0-blue.svg)](https://tauri.app)
[![TypeScript](https://img.shields.io/badge/typescript-5.3-blue.svg)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A powerful, privacy-focused media center built with Rust & Tauri.

Discover • Watch • Organize

[Features](#-features) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [Contributing](#-contributing)

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🎯 Core
- 🔍 **Smart Search** - TMDB-powered content discovery
- 📚 **Library Management** - Organize your collection
- 🎥 **HLS Player** - Smooth video playback
- 🧩 **Addon System** - Extensible content sources
- 🎨 **Modern UI** - Clean, responsive interface
- 🔄 **Auto-Updates** - Secure, signed releases

</td>
<td width="50%">

### 🛡️ Built-In
- 🔐 **Privacy First** - No telemetry, local-only data
- 🔒 **Security Hardened** - Strict CSP, input validation
- ⚡ **High Performance** - Rust backend, optimized frontend
- 🖥️ **Cross-Platform** - Windows, macOS, Linux
- 📱 **Responsive** - Adapts to any screen size
- 🌙 **Dark Theme** - Easy on the eyes

</td>
</tr>
</table>

## 🚀 Quick Start

### Prerequisites

```bash
# Required
- Rust 1.77.2+     → https://rustup.rs
- Node.js 18+      → https://nodejs.org
- TMDB API Key     → https://www.themoviedb.org/settings/api
```

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/GeneticxCln/StreamGo.git
cd StreamGo

# 2. Set up environment
cp .env.example .env
# Edit .env and add your TMDB API key

# 3. Install dependencies
npm install

# 4. Run development build
npm run dev              # Terminal 1: Vite dev server
npm run tauri:dev        # Terminal 2: Tauri app
```

### Build for Production

```bash
npm run build
npm run tauri:build      # Creates installer in src-tauri/target/release/bundle/
```

## 📖 Documentation

### For Users
- **[Keyboard Shortcuts](docs/KEYBOARD_SHORTCUTS.md)** - Navigate efficiently
- **[Security & Privacy](SECURITY.md)** - No telemetry, local data only
- **[Auto-Updates](SECURITY.md#auto-updates)** - How updates work

### For Developers  
- **[Contributing Guide](CONTRIBUTING.md)** - Development setup & guidelines
- **[CI/CD Troubleshooting](docs/CI-CD-Troubleshooting.md)** - Fix build issues
- **[Code Signing](docs/CODE_SIGNING.md)** - Release signing process
- **[Release Process](docs/RELEASE_PROCESS.md)** - Creating releases

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev             # Start Vite dev server
npm run tauri:dev       # Run Tauri app

# Quality Checks
npm run type-check      # TypeScript validation
npm run lint            # ESLint
npm run test:e2e        # Playwright E2E tests

# Rust (Makefile)
make check              # All Rust checks (fmt, clippy, test)
make ci                 # Full CI pipeline
```

### CI/CD

The project includes GitHub Actions workflows that enforce:

**Continuous Integration** (runs on push/PR):
- ✅ Rust code formatting (`cargo fmt --check`)
- ✅ Clippy linting with warnings as errors (`cargo clippy -- -D warnings`)
- ✅ All Rust unit tests pass
- ✅ TypeScript type checking
- ✅ ESLint compliance
- ✅ Successful builds
- ✅ E2E tests with Playwright

**Release Workflow** (runs on version tags):
- ✅ Cross-platform builds (Windows, macOS, Linux)
- ✅ Code signing with Tauri signing keys
- ✅ Automated GitHub releases with installers
- ✅ Auto-updater JSON manifest generation

All checks must pass before merging pull requests.

### Building for Production

1. Build the application:
   ```bash
   cd src-tauri
   cargo tauri build
   ```

The built application will be available in `src-tauri/target/release/bundle/`.

## 🔧 Tech Stack

<table>
<tr>
<td>

**Backend**
- Rust & Tauri 2
- SQLite database
- Tokio async runtime
- Reqwest HTTP client

</td>
<td>

**Frontend**  
- TypeScript
- Vite build system
- HLS.js player
- Native CSS

</td>
<td>

**Testing & CI**
- Playwright E2E
- Cargo tests
- GitHub Actions
- ESLint + Clippy

</td>
</tr>
</table>

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Make** your changes following our [Contributing Guide](CONTRIBUTING.md)
4. **Test** your changes (`make check` + `npm run ci`)
5. **Commit** with [conventional commits](https://www.conventionalcommits.org)
6. **Push** to your branch
7. **Open** a Pull Request

### Code Standards
- ✅ TypeScript type-safe code
- ✅ ESLint compliance  
- ✅ Rust fmt + clippy clean
- ✅ Tests for new features
- ✅ Clear commit messages

### Project Status

**✅ Phase 0 Complete** - Stabilization & Security  
**🔄 Phase 1 In Progress** - TypeScript & HLS Player  
**📋 Phase 2 Planned** - Advanced Addon Protocol  

See [EVOLUTION_ROADMAP.md](EVOLUTION_ROADMAP.md) for the complete roadmap.

---

<div align="center">

## 📜 License

MIT License - see [LICENSE](LICENSE) for details

## 💙 Acknowledgments

Built with [Tauri](https://tauri.app) • Inspired by [Stremio](https://www.stremio.com)  
Powered by [TMDB](https://www.themoviedb.org) • Made with ❤️ by the community

**[Star ⭐](https://github.com/GeneticxCln/StreamGo)** the project if you find it useful!

</div>
