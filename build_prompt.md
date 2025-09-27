You are an expert software engineer specializing in Rust and Tauri development. Your task is to help me build a desktop application that replicates the core functionality of Stremio, a popular open-source media center and video streaming app. Stremio allows users to discover, watch, and organize movies, TV shows, live TV, web channels, podcasts, and more by aggregating content from various sources via an extensible addon system.

Key requirements for this Stremio clone:

Technology Stack: Use Rust for the backend (handling logic, API integrations, and system interactions) and Tauri for building a lightweight, cross-platform desktop app (supporting Windows, macOS, and Linux). The frontend should be built with web technologies like HTML/CSS/JavaScript (or a framework like Svelte, React, or Vue if it simplifies development), embedded via Tauri's webview.

Core Features:

User authentication and profile syncing (e.g., via a simple backend API or local storage for watch history and favorites).

Content discovery: Search and browse movies, TV shows, etc., pulling from public APIs (e.g., TMDB for metadata, or open torrent indexes for streams—ensure ethical and legal handling).

Addon system: Allow users to install and manage addons (plugins) that provide content sources. Addons should be configurable, perhaps as Rust modules or JavaScript extensions loaded dynamically.

Streaming playback: Integrate a video player (e.g., via web-based players like Video.js or a Rust-based one like mpv-rs) to stream content from URLs provided by addons. Support subtitles, quality selection, and casting (e.g., to Chromecast using Tauri's IPC for external device integration).

Library organization: Users can add items to a watchlist, track progress, and get recommendations based on viewing history.

Offline support: Cache metadata and allow downloading content for offline viewing where possible.

UI/UX: Modern, intuitive interface with sections for home/discover, library, search, and settings. Make it responsive and themeable (light/dark mode).Architecture:

Backend in Rust: Handle file I/O, networking (e.g., HTTP requests for APIs), database (use SQLite or a lightweight embedded DB like sled for local storage), and threading for background tasks like fetching streams.

Tauri integration: Expose Rust functions to the frontend via Tauri's command system for secure IPC. Use Tauri's window management for a frameless, customizable app window.

Security: Sanitize inputs, handle CORS if needed, and avoid insecure practices like direct torrenting without user consent.

Performance: Optimize for low resource usage, fast loading, and smooth playback.

Development Guidelines:

Start with a minimal viable product (MVP): Focus on core streaming and addon support first, then expand.

Use best practices: Cargo for dependency management, error handling with anyhow or thiserror, async Rust with tokio for I/O-bound tasks.

Dependencies: Suggest useful crates like reqwest for HTTP, serde for JSON, rusqlite for DB, tauri-plugin-\* for extensions (e.g., for notifications or global shortcuts).

Testing: Include unit tests for backend logic and integration tests for Tauri commands.

Deployment: Guide on building distributables (e.g., MSI for Windows, DMG for macOS) and potential app store submissions.

Provide a step-by-step guide to building this app, including:

Setting up the project with Tauri CLI.

Structuring the code (directories for src-tauri in Rust, frontend in src).

Implementing key components with code snippets (Rust for backend, JS for frontend where needed).

Handling potential challenges like cross-origin issues in streaming or addon security.

Resources for learning (e.g., Tauri docs, Rust book sections).

Make your response comprehensive, with code examples, and assume I have intermediate knowledge of Rust but am new to Tauri. If anything is unclear, ask for clarification.