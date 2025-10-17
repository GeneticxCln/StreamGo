# This Week's Focus (Week of Oct 16)

## Monday-Tuesday: Build & Test

- [x] Build all Linux packages (AppImage, .deb, .rpm) - Build optimized
- [x] Test AppImage on Arch Linux - Dev mode running
- [x] Verify Wayland session works correctly - ✅ Hyprland detected
- [x] Check hardware acceleration (glxinfo) - ✅ NVIDIA RTX 3050 working
- [x] Install VAAPI/VDPAU drivers - ✅ H.264 + HEVC support confirmed
- [ ] Test video playback performance
- [ ] Benchmark startup time vs baseline

## Wednesday-Thursday: Wayland Optimization

- [ ] Test on GNOME/Wayland
- [ ] Test multi-monitor setup (if available)
- [ ] Test fractional scaling (125%, 150%, 200%)
- [ ] Fix any rendering issues
- [ ] Verify PiP mode works on Wayland
- [ ] Test fullscreen video playback

## Friday: Performance Profiling

- [ ] Install flamegraph: `cargo install flamegraph`
- [ ] Profile startup: `cargo flamegraph --bin streamgo`
- [ ] Identify bottlenecks
- [ ] Profile player initialization
- [ ] Document findings

## Weekend: Quick Wins

- [ ] Enable LTO in Cargo.toml for smaller binary
- [ ] Strip debug symbols in release
- [ ] Test with real addon (if available)
- [ ] Create basic AUR PKGBUILD template
- [ ] Update README with Linux-first focus

---

## Commands to Run

```bash
# 1. Build everything
cd src-tauri && cargo tauri build

# 2. Test AppImage
./target/release/bundle/appimage/streamgo_*.AppImage

# 3. Check Wayland
echo $XDG_SESSION_TYPE

# 4. Benchmark
hyperfine './target/release/streamgo'

# 5. Profile (this weekend)
cargo flamegraph --bin streamgo
```

---

## Success Metrics for This Week

- ✅ AppImage runs perfectly on your Arch system
- ✅ Wayland support verified working
- ✅ Startup time measured (baseline)
- ✅ No crashes or major bugs found
- ✅ Hardware acceleration confirmed working

---

**If you complete all this by Friday, you're in great shape for v1.0!**
