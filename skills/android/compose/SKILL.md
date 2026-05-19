---
name: android-compose
displayName: Jetpack Compose UI Patterns
description: >
  Jetpack Compose UI development patterns, component design, state management,
  and Material 3 theming for Android applications.
category: mobile
tags: [android, jetpack-compose, ui, kotlin, material3]
agents: [android-kotlin, mobile-qa]
toolkit_refs: [mobile]
---

# Jetpack Compose UI

## Core Patterns

### Composable Structure
```kotlin
@Composable
fun ScreenName(
    viewModel: ScreenViewModel = hiltViewModel(),
    modifier: Modifier = Modifier,
    onNavigate: (Route) -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    
    Scaffold(
        topBar = { TopAppBar(title = { Text("Screen") }) }
    ) { padding ->
        when (val state = uiState) {
            is UiState.Loading -> LoadingIndicator()
            is UiState.Success -> Content(state.data, modifier.padding(padding))
            is UiState.Error -> ErrorState(state.message, onRetry = viewModel::retry)
        }
    }
}
```

### State Management
- **ViewModel**: `hiltViewModel()` for DI, `viewModelScope.launch` for coroutines
- **StateFlow**: `.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), initial)`
- **collectAsStateWithLifecycle**: Respects lifecycle, avoids recomposition leaks
- **DerivedStateOf**: For computed state from existing state

### Material 3 Theming
- Use `MaterialTheme.colorScheme` for colors, `MaterialTheme.typography` for text
- Dynamic colors on Android 12+ via `dynamicColorScheme()`
- Custom color scheme in `Theme.kt` for branded apps

### Testing Compose
- `createComposeRule()` for composable testing
- `semantics { }` for accessibility-based selectors
- Compose UI Test library for interaction verification
