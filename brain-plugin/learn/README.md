# Learn Module — Ownership Boundaries

| File          | Owns                        | Mechanism                                                                                                                                                                  |
| ------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tuner.ts`    | **Context budget tuning**   | Monitors `context_efficiency` (used/retrieved chunks) across sessions; reduces `max_context_tokens` by 20% if consistently < 0.8. Contains absorbed eval scoring formulas. |
| `feedback.ts` | **Retrieval weight tuning** | Adjusts RRF alpha/beta weights per intent based on `tool.execute.after` success signals.                                                                                   |
| `tracer.ts`   | **Internal analytics**      | Read-only session metrics aggregator (decisions, intents, docs cache stats). No external dependencies — replaced the old `eval/bridge.ts`.                                 |

These three modules operate independently on different levers: context budget, retrieval weights, and observability. No coordinator needed at this stage.
