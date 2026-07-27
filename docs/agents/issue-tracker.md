# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature/effort per directory: `.scratch/<feature-slug>/`
- Spec: `.scratch/<feature-slug>/spec.md`
- Implementation issues: `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`
- `Status:` near top of each issue file

## Wayfinding operations

- **Map**: `.scratch/<effort>/map.md`
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md` with `Type:`, `Status:`, optional `Blocked by:`
- **Blocking**: `Blocked by: NN, NN` — unblocked when listed files are `Status: resolved`
- **Frontier**: open, unblocked, unclaimed; lowest number first
- **Claim**: set `Status: claimed` before work
- **Resolve**: `## Answer`, `Status: resolved`, pointer on map Decisions-so-far
