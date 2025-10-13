# Keyboard Shortcuts & Accessibility

StreamGo is designed to be fully keyboard-accessible with comprehensive shortcuts for all major functions.

## Table of Contents
- [Global Shortcuts](#global-shortcuts)
- [Video Player Shortcuts](#video-player-shortcuts)
- [Navigation Shortcuts](#navigation-shortcuts)
- [Accessibility Features](#accessibility-features)
- [Screen Reader Support](#screen-reader-support)

---

## Global Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + ,` | Open Settings |
| `Ctrl/Cmd + F` | Focus Search |
| `Ctrl/Cmd + Q` | Quit Application |
| `Ctrl/Cmd + R` | Refresh Library |
| `Ctrl/Cmd + N` | New Playlist |
| `Esc` | Close Modal/Panel |
| `Tab` | Navigate Forward |
| `Shift + Tab` | Navigate Backward |

---

## Video Player Shortcuts

### Playback Control
| Shortcut | Action |
|----------|--------|
| `Space` or `K` | Play/Pause |
| `J` | Rewind 10 seconds |
| `L` | Fast forward 10 seconds |
| `←` | Seek backward 10 seconds |
| `→` | Seek forward 10 seconds |
| `Home` | Jump to beginning |
| `End` | Jump to end |
| `0-9` | Jump to 0%-90% of video |

### Volume & Audio
| Shortcut | Action |
|----------|--------|
| `M` | Mute/Unmute |
| `↑` | Increase volume |
| `↓` | Decrease volume |

### Display
| Shortcut | Action |
|----------|--------|
| `F` | Toggle Fullscreen |
| `I` | Toggle Picture-in-Picture |
| `C` | Toggle Captions/Subtitles |
| `S` | Take Screenshot |

### Playback Speed
| Shortcut | Action |
|----------|--------|
| `<` | Decrease playback speed |
| `>` | Increase playback speed |
| `=` | Reset playback speed to 1x |

---

## Navigation Shortcuts

### Library Navigation
| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + 1` | Go to Library |
| `Ctrl/Cmd + 2` | Go to Discover |
| `Ctrl/Cmd + 3` | Go to Playlists |
| `Ctrl/Cmd + 4` | Go to Watchlist |
| `Ctrl/Cmd + 5` | Go to Favorites |

### List Navigation
| Shortcut | Action |
|----------|--------|
| `↑` / `↓` | Navigate items (list view) |
| `←` / `→` | Navigate items (grid view) |
| `Enter` | Select/Play item |
| `Space` | Quick preview |

### Context Menu
| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Click` | Open context menu |
| `Shift + F10` | Open context menu |

---

## Accessibility Features

### Visual Accessibility

#### High Contrast Mode
- **Toggle**: Settings > General > Theme > High Contrast
- Increases text contrast for better readability
- Enhances focus indicators

#### Font Size
- **Adjust**: Settings > General > Font Size
- Options: Small, Medium, Large, Extra Large
- Scales all UI text proportionally

#### Reduced Motion
- **Toggle**: Settings > General > Reduce Motion
- Disables animations and transitions
- Respects system preference

### Keyboard Navigation

#### Focus Indicators
- All interactive elements show clear focus rings
- Focus visible: 3px solid blue outline
- Focus follows keyboard navigation

#### Skip Links
- **Shortcut**: `Tab` (first item after page load)
- "Skip to main content" link
- "Skip to navigation" link
- "Skip to player controls" link

#### Tab Order
- Logical reading order (left-to-right, top-to-bottom)
- No keyboard traps
- All interactive elements reachable

### ARIA Labels

All interactive elements include proper ARIA attributes:
- `aria-label`: Descriptive labels for icons
- `aria-describedby`: Additional context
- `aria-live`: Dynamic content announcements
- `role`: Semantic roles for custom elements

### Screen Reader Support

StreamGo is fully tested with:
- **NVDA** (Windows)
- **JAWS** (Windows)
- **VoiceOver** (macOS)
- **Orca** (Linux)

#### Announcements
- Player status changes ("Playing", "Paused")
- Progress updates (every 10%)
- Error messages
- Toast notifications
- Loading states

---

## Tips for Keyboard Users

### Quick Navigation
1. Use `Tab` to move between sections
2. Use arrow keys within sections
3. Use `Enter` to activate buttons
4. Use `Space` to toggle checkboxes

### Player Shortcuts
1. `Space` is the universal play/pause
2. Arrow keys for seeking (left/right) and volume (up/down)
3. `F` for quick fullscreen toggle
4. `M` for quick mute

### Search Tips
1. `Ctrl/Cmd + F` focuses search from anywhere
2. `Esc` clears search
3. `↓` opens search suggestions
4. `Enter` executes search

---

## Customizing Shortcuts

### Custom Key Bindings
**Settings > Advanced > Keyboard Shortcuts**

1. Click on any action
2. Press your desired key combination
3. Conflicts are highlighted automatically
4. Reset to defaults anytime

### Modifier Keys
- **Windows/Linux**: `Ctrl`, `Alt`, `Shift`
- **macOS**: `Cmd`, `Option`, `Shift`

---

## Troubleshooting

### Shortcuts Not Working?

**Check for conflicts**:
1. Open Settings > Keyboard Shortcuts
2. Look for red highlights (conflicts)
3. Reassign conflicting shortcuts

**Browser shortcuts**:
- Some shortcuts may be captured by your browser
- Use alternative shortcuts or customize bindings

**Focus issues**:
- Click on the app window to ensure focus
- Check if a modal or panel is open

### Accessibility Issues

**Screen reader not announcing**:
1. Ensure screen reader is running
2. Refresh the page
3. Check Settings > Accessibility > Screen Reader Mode

**Focus not visible**:
1. Enable Settings > Accessibility > High Contrast
2. Check browser zoom level (should be 100%)

**Navigation problems**:
1. Ensure JavaScript is enabled
2. Clear browser cache
3. Update to latest version

---

## Feedback

### Report Accessibility Issues
If you encounter any accessibility barriers:

**Email**: accessibility@streamgo.app  
**GitHub**: [File an issue](https://github.com/quigsdev/StreamGo/issues) with label `accessibility`

### Suggest Improvements
We're committed to continuous improvement:
- Suggest new shortcuts
- Request accessibility features
- Share your experience

---

## Compliance

### Standards
StreamGo aims to meet:
- **WCAG 2.1 Level AA** (in progress)
- **Section 508** compliance
- **ARIA 1.2** specifications

### Testing
- Manual testing with assistive technologies
- Automated accessibility audits
- User testing with disabled individuals

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────┐
│          StreamGo Keyboard Shortcuts            │
├─────────────────────────────────────────────────┤
│  PLAYBACK                                       │
│  Space/K    Play/Pause                          │
│  ← →        Seek 10s                            │
│  F          Fullscreen                          │
│  M          Mute                                │
│  ↑ ↓        Volume                              │
│                                                  │
│  NAVIGATION                                     │
│  Ctrl+1-5   Switch sections                     │
│  Ctrl+F     Search                              │
│  Tab        Next element                        │
│  Esc        Close/Cancel                        │
│                                                  │
│  GENERAL                                        │
│  Ctrl+,     Settings                            │
│  Ctrl+N     New Playlist                        │
│  Ctrl+R     Refresh                             │
└─────────────────────────────────────────────────┘
```

---

## Additional Resources

- [Accessibility Statement](./ACCESSIBILITY.md)
- [User Guide](../README.md)
- [Settings Documentation](./SETTINGS.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)

---

**Last Updated**: 2025-01-13  
**Version**: 0.1.0
