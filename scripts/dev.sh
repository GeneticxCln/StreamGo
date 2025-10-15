#!/bin/bash
# Development script with Wayland webkit fix

export WEBKIT_DISABLE_DMABUF_RENDERER=1
cd src-tauri && cargo tauri dev
