# Phase 2: Advanced Features - Planning Document

## Overview

Phase 2 focuses on enhancing StreamGo with advanced features that improve the user experience and add professional-grade capabilities to the media center.

## Phase 2 Roadmap

### Priority 1: Core Enhancements (Recommended Start)

#### 2.1 Playlist Management 🎵
**Impact**: High | **Effort**: Medium | **Dependencies**: None

**Features**:
- Create custom playlists
- Add/remove media items from playlists
- Reorder playlist items (drag & drop)
- Auto-play next in playlist
- Save playlists to database
- Share playlists (export/import)

**Technical Requirements**:
- Rust: Playlist database schema and methods
- Frontend: Playlist UI components
- Player: Auto-advance to next item
- Tests: Unit tests for playlist operations

**Benefits**:
- Users can organize content their way
- Binge-watching made easy
- Better content discovery

---

#### 2.2 Picture-in-Picture (PiP) 📺
**Impact**: High | **Effort**: Low | **Dependencies**: Phase 1.2 (Player)

**Features**:
- Enable PiP mode while browsing
- Keyboard shortcut (P key)
- Persistent controls in PiP window
- Automatic positioning
- Resume from PiP seamlessly

**Technical Requirements**:
- Frontend: PiP API integration in player
- CSS: PiP window styling
- Tests: E2E tests for PiP activation

**Benefits**:
- Multitasking while watching
- Browse library without stopping video
- Modern UX feature

---

#### 2.3 Advanced Search & Filters 🔍
**Impact**: High | **Effort**: Medium | **Dependencies**: None

**Features**:
- Filter by genre, year, rating
- Sort by various criteria (date added, rating, title)
- Advanced search syntax
- Search history
- Saved searches
- Tag-based organization

**Technical Requirements**:
- Rust: Enhanced search queries with filters
- Frontend: Filter UI components
- Database: Indexed columns for performance
- Tests: Search filter test cases

**Benefits**:
- Easier content discovery
- Better library organization
- Faster finding specific content

---

### Priority 2: Quality of Life Features

#### 2.4 Keyboard Shortcuts & Accessibility ⌨️
**Impact**: Medium | **Effort**: Low | **Dependencies**: None

**Features**:
- Global keyboard shortcuts
- Customizable hotkeys
- Accessibility improvements (ARIA labels)
- Screen reader support
- High contrast mode
- Keyboard-only navigation

**Technical Requirements**:
- Frontend: Keyboard event handlers
- Settings: Hotkey configuration UI
- Database: Store custom key mappings
- Tests: Accessibility audit with axe

**Benefits**:
- Power user efficiency
- Accessibility compliance
- Better usability

---

#### 2.5 Video Playback Enhancements 🎬
**Impact**: Medium | **Effort**: Medium | **Dependencies**: Phase 1.2

**Features**:
- Playback speed control (0.5x - 2x)
- Chapter markers
- A-B repeat loop
- Screenshot capture
- Audio track selection
- Video rotation
- Zoom/Pan controls

**Technical Requirements**:
- Frontend: Player UI extensions
- Player: Speed control API
- Storage: Screenshot saving
- Tests: Playback feature tests

**Benefits**:
- More control over viewing
- Study/analysis features
- Better accessibility

---

#### 2.6 Download Management 📥
**Impact**: Medium | **Effort**: High | **Dependencies**: None

**Features**:
- Download media for offline viewing
- Queue management
- Progress tracking
- Pause/resume downloads
- Auto-delete old downloads
- Storage quota management

**Technical Requirements**:
- Rust: Download manager with async I/O
- Database: Download tracking
- Frontend: Download UI and progress
- Tests: Download state machine tests

**Benefits**:
- Offline viewing
- Better bandwidth management
- Improved reliability

---

### Priority 3: Advanced Features

#### 2.7 Casting Support 📡
**Impact**: Medium | **Effort**: High | **Dependencies**: Phase 1.2

**Features**:
- Chromecast integration
- DLNA/UPnP support
- AirPlay (where possible)
- Device discovery
- Remote control from app
- Multi-room sync

**Technical Requirements**:
- Rust: Casting protocol implementations
- Frontend: Device selection UI
- Network: Service discovery
- Tests: Mock casting devices

**Benefits**:
- Watch on TV/other devices
- Better home theater integration
- Professional feature set

---

#### 2.8 Content Recommendations 🎯
**Impact**: Medium | **Effort**: High | **Dependencies**: Phase 1.3

**Features**:
- "Because you watched" suggestions
- Trending content
- Similar content recommendations
- Personalized homepage
- Watch history analysis
- Genre preferences learning

**Technical Requirements**:
- Rust: Recommendation algorithm
- Database: User preference tracking
- Frontend: Recommendation UI
- Tests: Algorithm accuracy tests

**Benefits**:
- Better content discovery
- Increased engagement
- Personalized experience

---

### Priority 4: Advanced UI/UX

#### 2.9 Themes & Customization 🎨
**Impact**: Low | **Effort**: Medium | **Dependencies**: None

**Features**:
- Multiple theme options (dark, light, custom)
- Color customization
- Layout preferences
- Font size adjustments
- Background images
- Animation preferences

**Technical Requirements**:
- Frontend: CSS theming system
- Settings: Theme configuration
- Storage: User theme preferences
- Tests: Visual regression tests

**Benefits**:
- Personalized experience
- Better accessibility
- User preference support

---

#### 2.10 Multi-Profile Support 👥
**Impact**: Low | **Effort**: High | **Dependencies**: None

**Features**:
- Multiple user profiles
- Per-profile watch history
- Per-profile preferences
- Profile switching
- Profile pictures
- Parental controls

**Technical Requirements**:
- Rust: Multi-user database schema
- Auth: Profile selection/PIN
- Frontend: Profile management UI
- Tests: Multi-profile test cases

**Benefits**:
- Family sharing
- Separate watch histories
- Better privacy

---

## Recommended Phase 2 Implementation Order

### Phase 2.1: Playlist Management (Week 1-2)
**Why First?**
- High impact, medium effort
- Natural extension of library features
- No complex dependencies
- Immediate user value

**Deliverables**:
- Playlist database schema
- Playlist CRUD operations
- Playlist UI components
- Auto-play next feature
- Tests (unit + E2E)

---

### Phase 2.2: Picture-in-Picture (Week 2)
**Why Second?**
- High impact, low effort
- Quick win for users
- Minimal code changes
- Builds on existing player

**Deliverables**:
- PiP mode implementation
- PiP keyboard shortcut
- PiP UI polish
- Tests

---

### Phase 2.3: Advanced Search & Filters (Week 3-4)
**Why Third?**
- High impact for growing libraries
- Improves discoverability
- Medium effort
- Good UX improvement

**Deliverables**:
- Filter backend logic
- Filter UI components
- Sort functionality
- Search history
- Tests

---

## Technical Architecture

### Database Schema Extensions

```sql
-- Playlists
CREATE TABLE playlists (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    item_count INTEGER DEFAULT 0
);

CREATE TABLE playlist_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id TEXT NOT NULL,
    media_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    added_at TEXT NOT NULL,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id),
    UNIQUE(playlist_id, position)
);

-- Downloads
CREATE TABLE downloads (
    id TEXT PRIMARY KEY,
    media_id TEXT NOT NULL,
    url TEXT NOT NULL,
    file_path TEXT,
    status TEXT NOT NULL, -- pending, downloading, paused, completed, failed
    progress REAL DEFAULT 0.0,
    total_size INTEGER,
    downloaded_size INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    completed_at TEXT
);

-- User Profiles (if implementing 2.10)
CREATE TABLE profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TEXT NOT NULL,
    is_default BOOLEAN DEFAULT 0
);
```

### Frontend Components Structure

```
src/
├── components/
│   ├── playlist/
│   │   ├── PlaylistCard.ts
│   │   ├── PlaylistEditor.ts
│   │   └── PlaylistPlayer.ts
│   ├── filters/
│   │   ├── FilterBar.ts
│   │   ├── SortMenu.ts
│   │   └── GenreFilter.ts
│   └── downloads/
│       ├── DownloadManager.ts
│       ├── DownloadItem.ts
│       └── DownloadProgress.ts
├── types/
│   ├── playlist.d.ts
│   ├── download.d.ts
│   └── filter.d.ts
└── utils/
    ├── playlist-utils.ts
    ├── download-utils.ts
    └── filter-utils.ts
```

## Testing Strategy

### Unit Tests (Rust)
- Playlist operations (create, add, remove, reorder)
- Download state machine
- Search filter logic
- Recommendation algorithm

### E2E Tests (Playwright)
- Playlist creation and playback flow
- PiP activation and controls
- Filter application and sorting
- Download initiation and progress

### Performance Tests
- Large playlist handling (1000+ items)
- Search performance with filters
- Download speed benchmarks

## Success Criteria

### Phase 2.1 (Playlists)
- ✅ Create/edit/delete playlists
- ✅ Add/remove items from playlists
- ✅ Auto-play next in playlist
- ✅ Tests passing (10+ new tests)
- ✅ Documentation complete

### Phase 2.2 (PiP)
- ✅ PiP mode functional
- ✅ Keyboard shortcut works
- ✅ Controls persist in PiP
- ✅ Tests passing (5+ new tests)

### Phase 2.3 (Search)
- ✅ Genre/year/rating filters work
- ✅ Sort by multiple criteria
- ✅ Search history saved
- ✅ Performance acceptable (<100ms)
- ✅ Tests passing (15+ new tests)

## Risk Assessment

### Technical Risks
- **Casting**: Complex protocols, device compatibility issues
- **Downloads**: Large file handling, disk space management
- **Recommendations**: Algorithm accuracy, performance impact

### Mitigation Strategies
- Start with simpler features (Playlists, PiP)
- Incremental implementation with testing
- User feedback loops
- Performance monitoring

## Timeline Estimate

**Phase 2 Complete Duration**: 6-8 weeks

- **Phase 2.1** (Playlists): 1-2 weeks
- **Phase 2.2** (PiP): 3-5 days
- **Phase 2.3** (Search): 1-2 weeks
- **Phase 2.4** (Keyboard): 3-5 days
- **Phase 2.5** (Playback): 1 week
- **Phase 2.6** (Downloads): 2-3 weeks
- **Phase 2.7** (Casting): 2-3 weeks
- **Phase 2.8** (Recommendations): 2 weeks

## Resources Needed

### Development
- TypeScript/Rust experience
- UI/UX design skills
- Network protocol knowledge (for casting)
- Algorithm knowledge (for recommendations)

### Tools
- Database migration tools
- Performance profiling tools
- Testing frameworks (already in place)

## Questions to Consider

1. **Which features are most important to you?**
   - Playlists for organization?
   - PiP for multitasking?
   - Better search for large libraries?

2. **Do you plan to use this solo or share with family?**
   - Affects multi-profile priority

3. **Do you want offline viewing?**
   - Affects download manager priority

4. **Do you cast to TV?**
   - Affects casting support priority

5. **How large is your media library?**
   - Affects search/filter priority

## Next Steps

To proceed with Phase 2, we should:

1. **Choose Starting Feature**: Select Phase 2.1, 2.2, or 2.3
2. **Review Requirements**: Ensure all dependencies are met
3. **Create Detailed Specs**: Expand chosen feature
4. **Begin Implementation**: Start coding!

---

**Recommendation**: Start with **Phase 2.1 (Playlist Management)** as it:
- Provides immediate user value
- Has no complex dependencies
- Is a natural extension of Phase 1
- Sets foundation for future features (auto-play, queues, etc.)

**Alternative**: If you want a quick win first, do **Phase 2.2 (PiP)** - it's high impact, low effort, and can be done in a few days.

---

What would you like to start with? 🚀
