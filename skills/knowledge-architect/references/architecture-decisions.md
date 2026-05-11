# SignSync Architecture Decisions

## Decision 1: Offline-First Over Cloud-Native

### Context
Multiple iterations showed cloud dependency caused issues in restaurants with unreliable internet.

### Options Considered
1. Cloud-first with local cache
2. Hybrid (online/offline modes)
3. Offline-first with optional cloud sync

### Decision
**Offline-first with optional cloud sync**

### Rationale
- Restaurants operate 24/7 regardless of internet
- Local storage is faster and more reliable
- Cloud sync adds value without being mandatory

### Consequences
- All content must be downloadable and cacheable
- Sync queue for changes made offline
- Conflict resolution for multi-device scenarios

---

## Decision 2: Single Executable Deployment

### Context
Enterprise iteration required complex installers that caused support overhead.

### Options Considered
1. Native installer (MSI, DEB)
2. Portable executable
3. Container-based deployment

### Decision
**Single portable executable (.exe / binary)**

### Rationale
- Zero-configuration deployment
- USB-stick portability
- Easy rollback to previous versions

### Consequences
- All dependencies bundled
- Larger file size acceptable
- No system-level installation required

---

## Decision 3: Rust for Core Engine

### Context
Laravel PHP couldn't run on target hardware (low-spec devices, no server).

### Options Considered
1. Electron (JavaScript)
2. Tauri (Rust + WebView)
3. Native Qt/Gtk

### Decision
**Tauri (Rust + WebView)**

### Rationale
- Native performance for media playback
- Small binary size compared to Electron
- Rust ecosystem for hardware control
- Web technologies for UI flexibility

### Consequences
- Development requires Rust knowledge
- Native OS features accessible via Rust
- Cross-platform with single codebase

---

## Decision 4: M3U/M3U8 as Primary Playlist Format

### Context
Need standardized format for IPTV streams that users already know.

### Options Considered
1. Custom JSON format
2. Custom XML format
3. Standard M3U/M3U8

### Decision
**M3U/M3U8 with custom extensions**

### Rationale
- Industry standard for IPTV
- Users already have playlists
- Easy to import from existing sources

### Consequences
- Must parse and extend M3U format
- May need custom tags for signage metadata
- Backward compatibility with standard players

---

## Decision 5: Zone-Based Layout Engine

### Context
Need flexible layout system that supports multiple content types simultaneously.

### Options Considered
1. Template-based fixed layouts
2. Drag-and-drop canvas
3. Zone-based grid system

### Decision
**Zone-based grid system with template presets**

### Rationale
- Simpler than full canvas editor
- Predictable rendering for signage
- Easy to define in configuration

### Consequences
- Limited but sufficient flexibility
- Templates provide common patterns
- Custom zones require editing config files

---

## Decision 6: CCTV as Media Source

### Context
Users wanted to display camera feeds alongside content.

### Options Considered
1. Separate CCTV app with mirroring
2. Integrated RTSP stream as zone
3. Picture-in-picture overlay

### Decision
**Integrated RTSP stream as media source**

### Rationale
- Unified playback engine
- Same scheduling system for all sources
- Simplifies deployment

### Consequences
- Need RTSP client library
- Bandwidth considerations for multiple streams
- Motion detection integration possible

---

## Decision 7: YouTube/Radio as Media Sources

### Context
Users wanted streaming content (YouTube, internet radio) alongside local media.

### Options Considered
1. WebView embed for all streaming
2. Native playback with stream detection
3. Plugin system for different sources

### Decision
**Native playback with stream type detection**

### Rationale
- Consistent playback behavior
- Better performance than WebView
- Unified control interface

### Consequences
- Need protocols support (HLS, DASH, etc.)
- May need web extraction for YouTube
- Radio stream handling required