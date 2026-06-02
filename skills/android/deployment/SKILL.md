---
name: android-deployment
displayName: Android Deployment & CI
description: >
  Android app deployment workflows covering Play Store releases,
  CI/CD pipelines, code signing, and Tauri mobile distribution.
category: mobile
tags: [android, deployment, play-store, ci-cd, code-signing, tauri-mobile]
agents: [developer, qa-devops]
toolkit_refs: [gradle, mobile]
---

# Android Deployment & CI

## Build Types

### Debug Build
```bash
./gradlew assembleDebug
# Output: app/build/outputs/apk/debug/app-debug.apk
```
- Auto-signed with debug keystore
- Suitable for local testing and CI verification

### Release Build
```bash
./gradlew assembleRelease
# Output: app/build/outputs/apk/release/app-release.apk
```
- Requires signing config in `build.gradle.kts`
- ProGuard/R8 enabled for minification
- Generate signed bundle: `./gradlew bundleRelease`

### AAB (Android App Bundle)
```bash
./gradlew bundleRelease
# Output: app/build/outputs/bundle/release/app-release.aab
```
- Preferred format for Play Store distribution
- ~40% smaller than universal APK

## Code Signing

### Keystore Setup
```kotlin
// signing.gradle.kts
android {
    signingConfigs {
        create("release") {
            storeFile = file("../keystore/release.keystore")
            storePassword = System.getenv("KEYSTORE_PASSWORD")
            keyAlias = System.getenv("KEY_ALIAS")
            keyPassword = System.getenv("KEY_PASSWORD")
        }
    }
}
```

### Best Practices
- Store keystore encrypted in CI secrets, never in git
- Use different keystores for staging vs production
- Rotate keys annually, migrate gracefully via Play Console

## CI/CD Pipeline (via Workflow)

The `android-build-test-deploy` workflow orchestrates:
1. **Build** → Gradle MCP assembles APK
2. **Test** → Unit + instrumented via Gradle + Mobile MCP
3. **Deploy** → Release build with signing, upload to Play Store

For full pipeline, run: `/workflow android-build-test-deploy`

## Tauri Mobile Distribution

- Tauri generates Android project at `src-tauri/gen/android/`
- Build Tauri Android: `cargo tauri android build`
- The resulting APK is at `src-tauri/gen/android/app/build/outputs/apk/`
- Tauri bundles Rust binary inside the APK — no separate distribution needed
