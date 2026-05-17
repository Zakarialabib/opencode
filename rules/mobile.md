# Mobile Development Rules (Android/Kotlin + Tauri Mobile)

## Overview

Tauri v2 supports Android and iOS builds. Android uses Kotlin/Java with Gradle build system.
The frontend (React/TS) runs in a WebView on mobile, same as desktop. Native features
are accessed via Tauri plugins or custom Kotlin code.

## Context7 Documentation Sources

When working on mobile/Tauri-mobile, pull docs from:

- **tauri-mobile** → `tauri-apps/tauri` (v2 mobile section)
- **android-sdk** → `developer.android.com`
- **kotlin** → `kotlinlang.org`
- **gradle** → `gradle.org`
- **android-ndk** → `developer.android.com/ndk`
- **jetpack-compose** → `developer.android.com/jetpack/compose`
- **material-design** → `m3.material.io`

## Project Structure (Tauri Mobile)

```
src-tauri/
├── src/
│   └── main.rs              # Entry point (shared desktop+mobile)
├── gen/
│   └── android/             # Generated Android project
│       ├── app/
│       │   ├── build.gradle.kts
│       │   └── src/
│       │       └── main/
│       │           ├── AndroidManifest.xml
│       │           ├── kotlin/
│       │           │   └── com/example/app/
│       │           │       ├── MainActivity.kt
│       │           │       └── TauriPlugin.kt
│       │           └── res/
│       └── build.gradle.kts
├── capabilities/
│   └── mobile.json           # Mobile-specific permissions
├── Cargo.toml
└── tauri.conf.json
```

## Kotlin/Android Standards

### Kotlin

- Follow **Kotlin Coding Conventions**: https://kotlinlang.org/docs/coding-conventions.html
- Use `ktfmt` or `ktlint` for formatting
- Prefer `val` over `var`, use `data class` for models
- Use `sealed class` for sealed hierarchies (states, results)
- Use `coroutines` for async (suspend functions, Flow)
- Use `kotlinx.serialization` for JSON (not Gson)

### Android-Specific

- **Permissions**: Declare in `AndroidManifest.xml` + request at runtime for dangerous
- **Lifecycle**: Use `LifecycleOwner`, `viewModelScope`, `lifecycleScope`
- **UI**: Jetpack Compose for new UIs, XML layouts for legacy
- **Navigation**: Jetpack Navigation Compose
- **DI**: Hilt or Koin for dependency injection
- **Networking**: Ktor client or Retrofit + OkHttp
- **Local storage**: Room database or DataStore Preferences

### AndroidManifest.xml Essentials

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.CAMERA" />
  <application android:theme="@style/Theme.AppCompat.DayNight">
    <activity android:name=".MainActivity" android:exported="true">
      <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
      </intent-filter>
    </activity>
  </application>
</manifest>
```

## Tauri Mobile Build Commands

| Command                     | Purpose                        |
| --------------------------- | ------------------------------ |
| `cargo tauri android init`  | Initialize Android project     |
| `cargo tauri android dev`   | Run on Android device/emulator |
| `cargo tauri android build` | Build Android APK/AAB          |
| `cargo tauri ios init`      | Initialize iOS project         |
| `cargo tauri ios dev`       | Run on iOS simulator/device    |
| `cargo tauri ios build`     | Build iOS IPA                  |

## Tauri Mobile Configuration (tauri.conf.json)

```json
{
  "tauri": {
    "bundle": {
      "android": {
        "minSdkVersion": 24,
        "targetSdkVersion": 34
      },
      "ios": {
        "minimumIOSVersion": "15.0"
      }
    },
    "security": {
      "capabilities": ["mobile.json"]
    }
  }
}
```

## Mobile Permissions (capabilities/mobile.json)

```json
{
  "identifier": "mobile-capability",
  "windows": ["main"],
  "platforms": ["android", "ios"],
  "permissions": ["core:default", "fs:default", "http:default"]
}
```

## Frontend Mobile Patterns

### Tailwind Responsive

```tsx
// Mobile-first responsive classes
<div className="flex flex-col md:flex-row p-4 md:p-8">
  <div className="w-full md:w-1/2">
```

### Touch Events

```tsx
// Use onTouchStart/onTouchEnd for gestures
<div
  onTouchStart={handleTouchStart}
  onTouchEnd={handleTouchEnd}
  onTouchMove={handleTouchMove}
>
```

### Safe Area Handling

```tsx
// In Tailwind: use env(safe-area-inset-*)
// CSS: padding-top: env(safe-area-inset-top);
```

## When to Use Mobile Stack

- Building Android/iOS app via Tauri mobile
- Adding native plugins (camera, GPS, biometrics)
- Writing Kotlin code for Android-specific features
- Configuring Gradle build system
- Tauri mobile permissions and capabilities
