# Wayfinding

Disclosed from `reference.md`. Read when work is too big for one agent session — multi-session efforts where the way from here to the destination isn't visible yet.

Wayfinding is about finding the way, not charging at the destination. The operator never sees this protocol — they see questions, a map summary, and ticket-by-ticket progress. ce-lite initiates wayfinding internally when grilling reveals work that spans sessions.

## Plan, don't do

Wayfinding is **planning** by default: each ticket resolves a decision, and the map is done when the way is clear — nothing left to decide before someone goes and does the thing. The pull to just do the work is usually the signal you've reached the edge of the map and it's time to hand off to a contract loop. An effort can override this (carrying execution into the map itself), but absent that, produce decisions, not deliverables.

## When to wayfind vs contract

- **Contract loop** (single session): the work fits in one context window. Grill → terms → plan → execute → verify → compound.
- **Wayfinder map** (multi-session): the work is too big for one session, or the way forward is foggy. Chart a map, then resolve tickets one per session.

If grilling surfaces no fog, the way is already clear — run the contract loop. Don't create a map for work that fits in one session.

## The map

The map is a single markdown file — `.scratch/wayfinder/<effort-name>/MAP.md` — the canonical artifact. It's an **index**, not a store: it lists decisions made and points at the tickets that hold their detail. A decision lives in exactly one place — its ticket — so the map never restates it, only gists it and links.

### Map body

```markdown
## Destination
<what reaching the end of this map looks like — the spec, decision, or change this effort is finding its way to. One or two lines; every session orients to it before choosing a ticket.>

## Notes
<domain context; skills to load; anything every session should know.>

## Decisions so far
- <decision gist> → `TICKET-NN.md`
- ...

## Not yet specified
<fog — things you can't yet phrase as a ticket. Coarse, not pre-sliced.>

## Out of scope
<closed tickets that sit beyond the destination, with one-line reasons.>
```

Each ticket is a sibling markdown file: `.scratch/wayfinder/<effort-name>/TICKET-NN.md`.

## Charting (one session)

1. **Name the destination.** Grill depth-first to pin down what this map is finding its way to. The destination fixes the scope — settle it first.
2. **Map the frontier.** Grill breadth-first: fan out across the whole space, surfacing open decisions and first steps takeable now. If no fog surfaces, stop — you don't need a map.
3. **Create the map**: Destination and Notes filled in, Decisions-so-far empty, fog sketched into Not yet specified.
4. **Create the tickets you can specify now** as sibling files — then wire blocking edges in a second pass. Everything you can't yet specify stays in Not yet specified.
5. **Fire research subagents.** For each research ticket, spin up a `workflow` subagent (tier `small`) to resolve it in parallel. Capture findings with a context pointer from the ticket.
6. Stop — charting is one session's work. It hand-resolves nothing.

## Working a ticket (per session)

1. **Load the map** — the low-res view, not every ticket body.
2. **Choose the ticket.** If the operator named one, use it. Otherwise take the first frontier ticket in order. **Claim it**: mark it as in-progress at the top of the ticket file before any work.
3. **Resolve it** — fetch the full body of any related or closed ticket on demand. Route by ticket type (below). If in doubt, grill.
4. **Record the resolution**: write the answer as a resolution section at the bottom of the ticket file, mark the ticket closed, and append a one-line gist + link to the map's Decisions-so-far.
5. **Graduate fog**: when an answer makes previously-unspecifiable fog sharp enough to ticket, create the new ticket(s) and clear that patch from Not yet specified. If the answer reveals a ticket sits beyond the destination, close it and move it to Out of scope. If the decision invalidates other tickets, update or delete them.

Never resolve more than one ticket per session (except research tickets, which run in parallel as subagents).

## Ticket types

Each ticket is one of:

- **Research** (AFK): reading documentation, APIs, or local resources to surface a fact a decision waits on. Resolved by a `workflow` subagent (tier `small`). Use when knowledge outside the current context is required.
- **Prototype** (HITL): make a cheap, rough, concrete artifact to react to — an outline, a rough take, a stub. Use when "how should it look" or "how should it behave" is the key question. Present to the operator for reaction.
- **Grilling** (HITL): conversation via the grilling protocol (`grilling.md`), one question at a time. The default case — most tickets are this type.
- **Task** (HITL or AFK): manual work that must happen before a decision can be made — nothing to decide, prototype, or research, but the discussion is blocked until it's done. The agent drives it alone where it can (AFK); otherwise it hands the operator a precise checklist (HITL). Resolved when the work is done; the answer records what was done and any resulting facts.

## Blocking edges

Tickets declare their blocking edges at the top of the file: `Blocked by: TICKET-NN, TICKET-MM`. A ticket is **unblocked** when every ticket blocking it is closed. The **frontier** is the open, unblocked, unclaimed tickets — the edge of the known. Always work from the frontier.

## Refer by name

In everything the operator reads, refer to tickets by their title, never by a bare id. A wall of `TICKET-01, TICKET-02` is illegible; names read at a glance. The id rides inside the name, never stands in for it.
