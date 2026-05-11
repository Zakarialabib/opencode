# Classification Labels

| Label | Meaning | Canonical action |
| --- | --- | --- |
| `keep-exact` | Source idea is already simple and useful | Preserve in domain docs |
| `add-missing` | Useful idea is absent from domain docs | Add spec/workflow/decision/backlog |
| `merge-duplicate` | Repeated ideas across sources | Keep one canonical version |
| `expand-needed` | Incomplete but valuable | Add acceptance criteria and backlog |
| `simplify-with-ADR` | Complex old logic can be simplified | Use simple spec and record ADR |
| `obsolete-history` | Historical detail only | Keep lesson if useful |
| `open-question` | Product choice unresolved | Add to `gaps.md` and backlog |
