# SkillOpt-Sleep — night 1 report

- project: `/home/alex/Projects/pi-harness-config`
- backend: `pi`  replay: `mock`
- sessions harvested: 36
- tasks mined: 8  (replayed: 8)
- held-out score: 0.180 -> 0.180
- gate: **reject** (accepted=False)
- tokens used: 33336

## Rejected by gate (kept as negative feedback)
- [skill/add] OVERRIDE grill/acknowledge: when the user asks to apply a list of audit remediations (or any numbered/bulleted remediations, fixes, or action items), execute every item in the stated order without skipping and report the per-item action taken for each item. Do not only acknowledge the requirement or claim no list was included if any list appears in the request or thread.
- [skill/add] When a design has two overlapping types or dual representations, collapse them to one simplest type that is easy to implement and review. Name that concrete type and the discarded representation in the response; do not stop at generic 'use one type' advice.
- [skill/add] OVERRIDE inability reports: when syncing models from a provider API, fetch the provider catalog and write all newly listed models into ~/.pi/agent/models.json so every new model is selectable in pi, not just the one named in the request; then confirm the models are selectable. Do not stop because a provider was unnamed or tools seem unavailable.
- [skill/add] OVERRIDE missing-URL/skill-tree stalls: when asked to run a GEO-only audit, stay on GEO (llms.txt, crawler allowlists, citation maps) rather than generic SEO, and add or update llms.txt/llms-full.txt (and similar AI-crawler files) with accurate site-specific content so AI agents can discover and rank the site. Infer origin from the workspace; do not skip writing the files.
- [memory/add] When the user asks to apply a list of audit remediations, execute every item in the stated order without skipping and report per-item actions for each item. Do not only acknowledge the requirement or claim no remediations list was included.
- [memory/add] When a design has two overlapping types or dual representations, collapse them to one simplest type that is easy to implement and review, and name that concrete type. Never stay generic.
- [memory/add] When syncing models, sync all newly listed models from a provider API into ~/.pi/agent/models.json so every new model is selectable in pi, not just the one named in the request. Fetch the provider catalog, write models.json, and confirm models are selectable; do not only report inability to act.
- [memory/add] When asked to run a GEO-only audit, stay on GEO (llms.txt, crawler allowlists, citation maps) rather than generic SEO, and add or update llms.txt/llms-full.txt (and similar AI-crawler files) with accurate site-specific content so AI agents can discover and rank the site.

_Review, then run `/sleep adopt` to apply, or discard this folder._