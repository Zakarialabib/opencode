---
name: android
displayName: Android Development Core
description: >
  Comprehensive Android development skill covering Kotlin, Jetpack Compose,
  Gradle build systems, Clean Architecture, and modern Android development
  best practices. Serves as the root skill for all Android sub-skills.
category: mobile
tags: [android, kotlin, mobile, jetpack-compose, gradle, tauri-mobile]
agents: [developer, mobile-qa, qa-devops]
toolkit_refs: [gradle, mobile, android-emulator]
---

# Android Development

Core patterns and principles for Android development within the OpenCode Tauri + React + Laravel ecosystem.

## Project Context

This project uses **Tauri mobile** for Android builds. The Android layer is primarily for:
- **Tauri WebView** hosting the React frontend
- **Native plugins** for device features (camera, sensors, payments)
- **Kotlin bridge** between Rust backend and Android APIs

## Architecture Patterns

### Clean Architecture Layers (Google Recommended)

```
app/                    ← Android app module
├── src/main/
│   ├── java/com/project/
│   │   ├── di/         ← Dependency injection (Hilt/Koin)
│   │   ├── data/       ← Data layer (repositories, data sources)
│   │   ├── domain/     ← Domain layer (use cases, models)
│   │   └── ui/         ← Presentation layer (Compose screens, ViewModels)
│   └── AndroidManifest.xml
├── build.gradle.kts
└── src/test/           ← Unit tests
```

### Tauri-Android Integration

- Tauri generates `app/src/main/java/com/tauri/` with the Rust bridge
- Do NOT edit Tauri-generated files directly — use `tauri-plugin-*` crates
- Native Android plugins communicate via `Invoke` → Rust command → Android API

## Kotlin Conventions

- **Naming**: PascalCase for classes, camelCase for functions/variables, SCREAMING_SNAKE_CASE for constants
- **Null safety**: Use `?` nullable types, `?:` Elvis operator, `.let{}` for scope functions
- **Coroutines**: `viewModelScope.launch` for UI, `Dispatchers.IO` for network/db
- **State**: `StateFlow` over `LiveData` for Compose, `mutableStateOf` for simple state

## Workflow Integration

1. **MCP Servers**: Use `gradle` for builds, `mobile` for device interaction, `android-emulator` for emulator management
2. **Sub-skills**: See `compose/`, `gradle/`, `testing/`, `debugging/`, `deployment/` for specific workflows
3. **QA**: Use `mobile-qa` agent for UI testing and device compatibility verification
