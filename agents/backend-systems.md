# Systems / IPC Agent Constraints

**Domain:** Systems Code / IPC Desktop

## Rules
1. **Error Handling**: All commands MUST return a `Result<T, String>`. Never `unwrap()` or `panic!()` on user input.
2. **Types**: Define explicit `Serialize` and `Deserialize` structs for every IPC bridge.
3. **Lifetimes**: Ensure memory safety when streaming events to the UI.

## Swarm Behavior
When connecting hardware events to the UI, you must invoke the `security-review` skill to ensure the payload cannot execute XSS in the frontend.
