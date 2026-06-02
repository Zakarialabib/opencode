---
name: android-gradle
displayName: Gradle Build System
description: >
  Gradle build configuration, dependency management, build variants,
  and optimization for Android projects using Kotlin DSL and version catalogs.
category: mobile
tags: [android, gradle, kotlin-dsl, build-system, dependency-management]
agents: [developer, mobile-qa, qa-devops]
toolkit_refs: [gradle]
---

# Gradle Build System

## Build Configuration

### Version Catalog (`libs.versions.toml`)
```
[versions]
agp = "8.7.0"
kotlin = "2.1.0"
compose-bom = "2025.05.00"
hilt = "2.52"

[libraries]
androidx-core = { group = "androidx.core", name = "core-ktx", version = "1.15.0" }
compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "compose-bom" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
```

### Build Variants
```kotlin
android {
    buildTypes {
        debug {
            isDebuggable = true
            applicationIdSuffix = ".debug"
        }
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            signingConfig = signingConfigs.getByName("release")
        }
    }
    flavorDimensions += "environment"
    productFlavors {
        create("staging") { dimension = "environment" }
        create("production") { dimension = "environment" }
    }
}
```

## MCP Workflows

### Build via Gradle MCP
1. `gradle` server → `run_task` with `:app:assembleDebug`
2. Verify APK at `app/build/outputs/apk/debug/`
3. Run lint: `gradle` → `run_task` with `:app:lint`
4. Dependencies: `gradle` → `run_task` with `:app:dependencies`

### Performance Tips
- Use `--build-cache` and `--parallel` flags
- Enable `isMinifyEnabled` only for release builds
- Use `implementation` over `api` to limit dependency leakage
