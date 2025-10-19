# StreamGo vs. Stremio: A Comparative Analysis

This document provides a detailed comparison between StreamGo and the well-established media center, Stremio.

## Core Philosophy: A Shared Vision

At their core, both StreamGo and Stremio are built on the same fundamental concept: a centralized media hub that aggregates content from various sources using an extensible addon system. Users can install addons to pull in content from streaming services, torrents, and other online sources, creating a unified browsing and viewing experience.

## Detailed Comparison

| Feature | StreamGo | Stremio | Analysis |
|---|---|---|---|
| **Open Source Model** | ✅ **Fully Open Source** | ☑️ **Semi Open Source** | StreamGo is developed entirely in the open. Stremio has open-sourced its core and most of its desktop app, but parts remain proprietary, and it wasn't always as open as it is today. |
| **Technology: Core** | ✅ **Rust** | ✅ **Rust (`stremio-core`)** | Both projects leverage Rust for their core logic, benefiting from its performance, safety, and reliability. This is a significant architectural similarity. |
| **Technology: Backend**| ✅ **Rust (Tauri)** | ☑️ **Node.js** | StreamGo uses Rust for its entire backend via the Tauri framework. Stremio uses a Node.js backend to complement its Rust core. |
| **Technology: Frontend**| ✅ **Svelte & TypeScript** | ☑️ **React Native & Qt** | StreamGo uses modern web technologies (Svelte) compiled into a webview via Tauri. Stremio uses a more native approach with Qt for desktop and React Native for mobile. |
| **Platform Availability**| 🖥️ **Desktop Only** (Win, Mac, Linux) | 🌍 **Cross-Platform** (Desktop, Android, iOS, TV) | Stremio is the clear leader here, with official applications across a vast range of devices. StreamGo is currently focused on the desktop experience. |
| **Addon Architecture** | 🟡 **Local & In-Development** | ✅ **Remote & Mature** | Stremio's addons run remotely, which enhances security. StreamGo's addon system is still under active development. The maturity of Stremio's addon ecosystem is a major advantage. |
| **Privacy Policy** | ✅ **Strictly No-Telemetry** | ✅ **Strong Privacy** | Both projects have a strong focus on privacy. StreamGo's README states a "no telemetry" policy. Stremio's privacy policy explicitly states it does not log user streaming history or addon usage. |
| **Monetization** | ❌ **None** | ☑️ **Ad-Supported** | StreamGo has no monetization model. Stremio is free to use and supported by privacy-preserving ads and potential affiliate partnerships. |
| **Key Features** | - Addon System<br>- HLS/DASH Player<br>- Library Management<br>- Casting (In-dev) | - Remote Addons<br>- Cross-Device Sync<br>- Calendar Tracking<br>- Offline Viewing<br>- Trakt Integration | Stremio is a much more mature product with a richer feature set, most notably cross-device library and history syncing. StreamGo has a solid foundation but lacks these advanced features. |
| **Project Status** | 🚀 **In Active Development** | ✅ **Mature & Established** | StreamGo is a newer project, rapidly evolving and building out its core functionality. Stremio is a stable, long-standing application with a large user base. |

## Summary

**StreamGo** is a promising, modern, and open-source alternative to Stremio, built with a similar privacy-first philosophy and a shared reliance on Rust for its core logic. Its use of Tauri and Svelte represents a more modern approach to desktop application development compared to Stremio's established Qt framework.

**Stremio** is the mature and established player with a massive advantage in platform availability (especially mobile) and feature completeness (like cross-device sync). Its semi-open-source model and ad-based revenue stream are key differentiators.

In essence, **StreamGo is what Stremio might look like if it were built from the ground up today with a fully open-source model and the latest web-centric desktop technologies.** Stremio's maturity and broad device support make it the go-to choice for most users now, but StreamGo's modern architecture and transparent development make it a project to watch closely.
