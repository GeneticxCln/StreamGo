# 🔧 CI/CD Troubleshooting Guide: Why GitHub Actions Fail

## 🚨 **Common Reasons for CI/CD Failures**

### **1. Dependency Installation Issues** (Most Common)

**Problem**: Package managers fail to install system dependencies
```yaml
# ❌ PROBLEMATIC
- name: Install dependencies
  run: sudo apt-get install libgtk-dev
```

**Solutions**:
```yaml
# ✅ ROBUST SOLUTION
- name: Install system dependencies
  run: |
    sudo apt-get update && sudo apt-get upgrade -y
    sudo apt-get install -y \
      libgtk-3-dev \
      libwebkit2gtk-4.0-dev \
      libayatana-appindicator3-dev \
      librsvg2-dev \
      patchelf \
      build-essential \
      curl \
      wget \
      file
```

**Root Causes**:
- Package name changes (e.g., `libappindicator3-dev` → `libayatana-appindicator3-dev`)
- Missing package repository updates
- Wrong package versions for Ubuntu runner versions
- Missing build tools

### **2. Node.js/npm Version Conflicts**

**Problem**: Using system Node.js instead of specified version
```yaml
# ❌ PROBLEMATIC - Uses random system Node.js
- name: Install dependencies
  run: npm install
```

**Solution**:
```yaml
# ✅ FIXED - Explicit Node.js version
- name: Install Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '18'
    cache: 'npm'
```

### **3. Rust Toolchain Issues**

**Problems**:
- Wrong Rust version
- Missing components (rustfmt, clippy)
- Target architecture mismatches

**Solutions**:
```yaml
# ✅ COMPREHENSIVE RUST SETUP
- name: Install Rust
  uses: dtolnay/rust-toolchain@stable
  with:
    components: rustfmt, clippy

# Add rust target for cross-compilation if needed
- name: Add Rust targets
  run: rustup target add x86_64-unknown-linux-gnu
```

### **4. Tauri-Specific Issues**

**Common Problems**:
- Missing WebView dependencies
- GTK version conflicts
- Display server issues (no X11/Wayland in CI)

**Solutions**:
```yaml
# ✅ TAURI-READY DEPENDENCIES
- name: Install Tauri dependencies
  run: |
    sudo apt-get update
    sudo apt-get install -y \
      libwebkit2gtk-4.0-dev \
      libgtk-3-dev \
      libayatana-appindicator3-dev \
      librsvg2-dev \
      patchelf

# For GUI apps that need display
- name: Setup virtual display
  run: |
    sudo apt-get install -y xvfb
    export DISPLAY=:99
    Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
```

## 🎯 **Best Practices**

### **1. Progressive CI Strategy**
Start simple, add complexity gradually:

1. **Basic checkout and compile check**
2. **Add dependency installation**
3. **Add testing**
4. **Add multi-platform builds**
5. **Add release automation**

### **2. Error Recovery & Debugging**
```yaml
# Always collect logs on failure
- name: Upload logs on failure
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: build-logs
    path: |
      src-tauri/target/debug/build/*/output
      ~/.cargo/registry/
    retention-days: 3
```

## 🔍 **StreamGo-Specific Fix Applied**

**Issue**: `libappindicator3-dev` package renamed in newer Ubuntu
**Solution**: Updated to `libayatana-appindicator3-dev`
**Result**: Fixed CI dependency installation

The key is **incremental improvement** - fix one issue at a time! 🚀