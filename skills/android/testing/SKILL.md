---
name: android-testing
displayName: Android Testing
description: >
  Android testing strategies covering unit tests, instrumented tests,
  UI tests with Compose, and integration testing for Tauri mobile apps.
category: mobile
tags: [android, testing, unit-test, instrumented-test, compose-test]
agents: [android-kotlin, mobile-qa]
toolkit_refs: [gradle, mobile]
---

# Android Testing

## Test Types

### Unit Tests (`src/test/`)
- **Framework**: JUnit 5 + MockK for Kotlin mocking
- **Coverage**: ViewModels, Use Cases, Repositories, Mappers
- **Pattern**: Given-When-Then with descriptive test names
```kotlin
@Test
fun `given valid input, when login called, then returns success`() {
    // Given
    val mockRepo = mockk<AuthRepository>()
    every { mockRepo.login(any()) } returns Result.success(User("test"))
    
    // When
    val result = LoginUseCase(mockRepo)("user", "pass")
    
    // Then
    assertTrue(result.isSuccess)
}
```

### Instrumented Tests (`src/androidTest/`)
- **Framework**: Compose UI Test + Espresso for legacy views
- **Scope**: UI interaction, navigation, database, permissions
- **Run via**: `gradle` MCP → `:app:connectedCheck`

### UI Tests (Compose)
```kotlin
@RunWith(AndroidJUnit4::class)
class LoginScreenTest {
    @get:Rule val composeTestRule = createComposeRule()
    
    @Test
    fun `displays error on invalid login`() {
        composeTestRule.setContent { LoginScreen(viewModel = mockViewModel()) }
        composeTestRule.onNodeWithText("Login").performClick()
        composeTestRule.onNodeWithText("Invalid credentials").assertIsDisplayed()
    }
}
```

### Tauri-Specific Testing
- Test Kotlin bridge methods with unit tests
- Verify `Invoke` handler mappings match Rust commands
- Test plugin callbacks with mock Rust bridge

## MCP Workflows

### Via Gradle MCP
- Unit tests: `run_task` with `:app:testDebugUnitTest`
- Instrumented: `run_task` with `:app:connectedDebugAndroidTest`
- Coverage: `run_task` with `:app:testCoverage`

### Via Mobile MCP
- Launch app for manual verification: `install_app` + `launch_app`
- Screenshot verification: `screenshot` at each test step
- UI hierarchy inspection: `capture_ui_hierarchy`
