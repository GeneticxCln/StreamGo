# StreamGo Optimization for Hyprland/Wayland

**Your Setup**: NVIDIA RTX 3050 + Hyprland + Wayland  
**Status**: Hardware acceleration enabled ✅

---

## Hardware Acceleration

### Current Status
```
GPU: NVIDIA GeForce RTX 3050 Laptop GPU
Driver: NVIDIA 580.95.05
Direct Rendering: Yes ✅
OpenGL: 4.6 ✅
Session: Wayland (Hyprland) ✅
```

### Video Decoding
NVIDIA hardware decoding (NVDEC) should work automatically through:
- **VAAPI** (Video Acceleration API)
- **VDPAU** (Video Decode and Presentation API)

### Verify Hardware Decoding
```bash
# Check VAAPI support
vainfo

# Check VDPAU support  
vdpauinfo

# If not installed:
sudo pacman -S libva-nvidia-driver libvdpau
```

---

## Hyprland-Specific Optimizations

### Window Rules
Add to `~/.config/hypr/hyprland.conf`:

```ini
# StreamGo optimizations
windowrulev2 = tile, class:^(streamgo)$
windowrulev2 = idleinhibit focus, class:^(streamgo)$  # Prevent screen sleep during playback
windowrulev2 = opaque, class:^(streamgo)$  # No transparency for better performance

# When fullscreen (video playback)
windowrulev2 = immediate, class:^(streamgo)$, fullscreen:1  # Disable compositor for fullscreen
```

### Performance Tweaks
```ini
# In hyprland.conf general section
misc {
    disable_hyprland_logo = true  # Less overhead
    disable_splash_rendering = true
    vfr = true  # Variable refresh rate
    vrr = 1  # VRR for supported displays
}

# Render settings
render {
    explicit_sync = 2  # For NVIDIA, use mailbox mode
    direct_scanout = true  # Direct scanout for fullscreen apps
}
```

---

## Performance Targets

| Metric | Target | Test Command |
|--------|--------|--------------|
| Startup | < 1s | `hyperfine 'streamgo'` |
| Memory | < 150MB | `ps aux \| grep streamgo` |
| CPU (idle) | < 2% | `top` |
| GPU decode | Active | `nvidia-smi dmon` |

---

## Testing Checklist

### Basic Functionality
- [x] App launches on Wayland
- [ ] Video playback smooth (60fps)
- [ ] Hardware decoding active
- [ ] PiP mode works
- [ ] Fullscreen works
- [ ] Multi-monitor support
- [ ] Fractional scaling (if used)

### Video Format Tests
- [ ] MP4/H.264 playback
- [ ] HEVC/H.265 playback  
- [ ] HLS streaming (.m3u8)
- [ ] DASH streaming (.mpd)
- [ ] 1080p playback
- [ ] 4K playback (if available)

### Wayland Features
- [ ] Native window decorations
- [ ] Screen sharing works
- [ ] Clipboard integration
- [ ] Drag & drop
- [ ] Touch screen (if applicable)

---

## Known Optimizations Applied

1. ✅ **Native Wayland** - No XWayland overhead
2. ✅ **Hardware Acceleration** - NVIDIA NVDEC/CUDA
3. ✅ **Async Runtime** - Tokio for non-blocking I/O
4. ✅ **Efficient Rendering** - GPU-accelerated CSS
5. ✅ **Lazy Loading** - Images and modules on demand

---

## Performance Monitoring

### During Playback
```bash
# Monitor GPU usage
watch -n 1 nvidia-smi

# Check if hardware decoding is active
# Video engine should show usage, not 3D/Compute

# Monitor CPU/Memory
htop
```

### Benchmark vs Stremio
```bash
# Startup time
hyperfine --warmup 2 'streamgo' 'stremio'

# Memory usage
ps aux | grep -E "(streamgo|stremio)" | awk '{print $6/1024 " MB - " $11}'
```

---

## Compositor-Off Mode (Maximum Performance)

For fullscreen video, Hyprland can disable compositing:

```ini
# In hyprland.conf
windowrulev2 = immediate, class:^(streamgo)$, fullscreen:1
```

This gives **direct scanout** = lowest latency, highest performance!

---

## Next Steps

1. **Install VAAPI drivers**:
   ```bash
   sudo pacman -S libva-nvidia-driver
   vainfo  # Verify it works
   ```

2. **Apply Hyprland rules** (see above)

3. **Test video playback** with different formats

4. **Benchmark** startup and performance

5. **Report issues** if anything doesn't work smoothly

---

## Troubleshooting

### Video Stuttering
- Check: `nvidia-smi` during playback
- Enable: `render { direct_scanout = true }`
- Disable: VSync if causing issues

### Tearing
- Enable: `misc { vrr = 1 }`
- Check: Monitor supports VRR/FreeSync

### High CPU Usage
- Verify hardware decoding active
- Check `nvidia-smi dmon` shows video engine usage

---

**Last Updated**: 2025-10-16  
**Tested On**: NVIDIA RTX 3050 + Hyprland + Arch Linux
