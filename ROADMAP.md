# StreamGo Development Roadmap

This document outlines the strategic roadmap for StreamGo, focusing on stabilization, modernization, and distribution. This plan is based on a fresh analysis of the codebase as of October 2025.

---

## Phase 1: Core Functionality & Stability

**Objective:** Solidify the application's foundation by completing critical, half-finished features identified in the codebase.

| Feature | Status | Priority | Details |
|---|---|---|---|
| **Robust Streaming Server** | 🔴 Not Started | Critical | Replace the placeholder streaming server in `src-tauri/src/streaming_server.rs` with a full implementation that supports HTTP range requests, essential for video seeking. |
| **Full Subtitle Integration** | 🟡 Incomplete | High | Connect the subtitle parsing and fetching logic to the video player. This involves passing the correct subtitle URL/data to the player UI, as noted by the `TODO` in `src/app.ts`. |
| **Casting UI** | 🔴 Not Started | High | Implement the Svelte components and UI controls for the existing backend casting functionality. The backend appears to have casting logic, but there is no frontend interface to control it. |
| **Auto-Updater Verification** | 🟡 Incomplete | Medium | Thoroughly test and confirm that the Tauri auto-updater is fully configured and functional across all target platforms (Windows, macOS, Linux). |

---

## Phase 2: Frontend Modernization & UI Polish

**Objective:** Unify the frontend architecture by completing the migration to Svelte, and refine the user experience for a polished, modern feel.

| Feature | Status | Priority | Details |
|---|---|---|---|
| **Complete Svelte Migration** | 🟡 Incomplete | Critical | Rewrite all remaining legacy vanilla TypeScript components (currently in `src/legacy/`) into Svelte. This will create a consistent, maintainable, and performant frontend codebase. |
| **UI/UX Audit & Refinement** | 🔴 Not Started | High | Conduct a full review of the application to identify and fix UI inconsistencies, improve workflows, and polish animations and visual feedback. |
| **Skeleton Content Loaders** | 🔴 Not Started | Medium | Implement skeleton loaders for all data-heavy views (like the media library and search results) to improve perceived loading performance. |
| **Centralized Error Handling** | 🔴 Not Started | Medium | Develop a user-friendly, non-intrusive error notification system that provides clear feedback and potential solutions when an operation fails. |

---

## Phase 3: Feature Expansion & Distribution

**Objective:** Broaden the application's feature set and prepare it for a wider audience through official packaging and comprehensive documentation.

| Feature | Status | Priority | Details |
|---|---|---|---|
| **Official Linux Packages** | 🔴 Not Started | High | Create and maintain official `AppImage` and Arch User Repository (`AUR`) packages to simplify installation and updates for Linux users. |
| **Comprehensive Documentation** | 🔴 Not Started | High | Write a clear, user-friendly guide covering installation, features, and troubleshooting. Expand the developer documentation to encourage community contributions. |
| **Telemetry Strategy** | 🔴 Not Started | Low | Define a privacy-first telemetry strategy. If approved, implement the necessary backend endpoint and opt-in UI to gather anonymous usage data for future improvements. |
| **Community Building** | 🔴 Not Started | Low | Establish a community hub (e.g., Discord server or GitHub Discussions) to gather feedback and support users and contributors. |
