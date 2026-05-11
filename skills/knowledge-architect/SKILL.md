---
name: knowledge-architect
description: Consolidate digital signage, SignSync, Media OS, SaaS signage, restaurant POS signage, CCTV/media nexus, Tauri desktop, and research documentation into a domain-first, source-traced Media OS knowledge base.
---

# Media OS Knowledge Architect

Use this skill to process fragmented signage documentation into the canonical `media-os-knowledge/` structure. Raw project folders are evidence and must remain unchanged.

## Product Center

Media OS is canonical. SignSync, SaaS signage, restaurant/POS signage, CCTV, IPTV/radio, AI, and fleet management are modules or product layers around a local-first Media OS runtime.

## Output Structure

Maintain this structure:

```text
media-os-knowledge/
  agent-index.md
  source-manifest.md
  00-index.md
  01-source-inventory.md
  02-domain-map.md
  03-work-spec.md
  04-feature-matrix.md
  05-workflows.md
  06-architecture-decisions.md
  07-improvement-backlog.md
  domains/
    player-runtime/
    layout-composition/
    content-assets/
    media-sources/
    restaurant-pos/
    device-fleet/
    sync-offline/
    orchestration/
    security-licensing/
    ai-optimization/
    research-strategy/
  extraction-cards/
```

Each domain folder must contain:

- `README.md`
- `specs.md`
- `workflows.md`
- `decisions.md`
- `gaps.md`

## Domain Routing

| Source topic | Domain |
| --- | --- |
| player, renderer, display, window, playback, startup | `player-runtime` |
| screen, zone, template, widget, canvas, composer, editor | `layout-composition` |
| asset, content, playlist, schedule, campaign, media library | `content-assets` |
| source, stream, RTSP, CCTV, M3U, HLS, radio, YouTube, camera | `media-sources` |
| menu, POS, order, payment, printing, TV display | `restaurant-pos` |
| device, tenant, workspace, onboarding, pairing, fleet, heartbeat | `device-fleet` |
| offline, sync, local DB, cache, queue, conflict | `sync-offline` |
| event, orchestrator, service registry, workflow, mesh, federation | `orchestration` |
| auth, security, role, license, audit, update, secret | `security-licensing` |
| AI, generation, guard, optimization, recommendation | `ai-optimization` |
| market, strategy, roadmap, Android TV, study, report, pitch | `research-strategy` |

## Classification Labels

Use these labels in `gaps.md`, extraction cards, and backlog updates:

- `keep-exact`: existing idea is already simple and canonical.
- `add-missing`: useful idea is absent from canonical docs.
- `merge-duplicate`: same idea appears in multiple projects.
- `expand-needed`: idea is promising but incomplete.
- `simplify-with-ADR`: old logic is complex and a simpler Media OS approach exists.
- `obsolete-history`: historical detail is not part of current product.
- `open-question`: product choice cannot be resolved from sources.

## Source Reference Standard

Canonical docs cite source folders plus key files. Example:

`Source evidence: concepts/screen.md; nexussignage-docs/Composer_Module.md; syngsinc-docs/features/TEMPLATES.md`

Do not cite every sentence. Cite major requirements, workflows, decisions, and unresolved gaps.

## Processing Workflow

1. Build or update `source-manifest.md`.
2. Update `01-source-inventory.md` with counts, source families, key files, and deferred non-Markdown files.
3. Route Markdown source clusters into domains.
4. For each domain, update `README.md`, `specs.md`, `workflows.md`, `decisions.md`, and `gaps.md`.
5. Update overview files after domain processing.
6. Create extraction cards only for high-value, conflicting, duplicate-heavy, or unclear source clusters.

## Simplification Rule

When historical projects disagree, prefer the simplest Media OS-compatible approach in canonical specs. Preserve older/complex approaches in ADRs or `gaps.md`.

## Quality Checklist

- [ ] Raw source folders are untouched.
- [ ] Every domain has the five required files.
- [ ] Every domain references at least one source folder and key file.
- [ ] Specs use `SPEC-*` identifiers.
- [ ] Mermaid diagrams are fenced with `mermaid`.
- [ ] Non-Markdown files are inventoried before deep extraction.
- [ ] Backlog items are actionable and mapped to domains.
