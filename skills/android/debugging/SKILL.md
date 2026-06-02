---
name: android-debugging
displayName: Android Debug & Inspect
description: >
  ADB-powered debugging, UI inspection, crash analysis, and device
  diagnostics for Android applications.
category: mobile
tags: [android, debugging, adb, crash-analysis, logcat, ui-inspection]
agents: [developer, mobile-qa, qa-devops]
toolkit_refs: [mobile, android-emulator]
---

# Android Debug & Inspect

## ADB Workflows

### Device Management
```bash
adb devices                    # List connected devices
adb connect 192.168.1.x:5555  # Connect remote device
adb disconnect                 # Disconnect all
```

### Log Analysis
```bash
adb logcat -c                  # Clear logs
adb logcat *:E                 # Only errors
adb logcat -v threadtime       # With thread timing
adb logcat | grep "CrashReport" # Filter specific tag
```

### UI Inspection
- **Mobile MCP**: `capture_ui_hierarchy` for View tree, `screenshot` for visual state
- **Manual**: `adb shell uiautomator dump` for XML hierarchy
- **Layout Inspector**: Via Mobile MCP wrapper

### Crash Analysis
- **Tombstones**: `adb pull /data/tombstones/` for native crashes
- **ANR traces**: `adb pull /data/anr/` for ANR traces
- **Heap dump**: `adb shell am dumpheap <pid> /data/local/tmp/heap.hprof`
- **Memory**: `adb shell dumpsys meminfo <package>` for memory analysis

### Tauri Mobile Debugging
- Tauri Android logs appear in logcat with tag `Tauri`
- WebView debugging: enable via `chrome://inspect` on desktop Chrome
- Rust panics in Tauri appear as native crashes in logcat

## MCP Workflows

### Via Mobile MCP
1. `screenshot` — capture visual state for comparison
2. `capture_ui_hierarchy` — inspect composable tree
3. `tap`/`type`/`swipe` — interact with specific elements

### Via Android Emulator MCP
1. `start_emulator` — start AVD
2. `wait_for_boot` — confirm booted
3. `stop_emulator` — clean shutdown

### Common Debug Scenarios
| Symptom | Action |
|---------|--------|
| App crashes on launch | Check logcat for `FATAL EXCEPTION`, verify manifest permissions |
| Blank screen | Check Compose tree via `capture_ui_hierarchy`, verify theme loaded |
| ANR (not responding) | Pull `/data/anr/traces.txt`, check main thread blocking |
| Network errors | `adb shell dumpsys connectivity`, verify Tauri URL whitelist |
