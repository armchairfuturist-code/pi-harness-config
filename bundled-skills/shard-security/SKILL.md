---
name: shard-security
description: Apply OS sandboxing, project-local tool permissions, and credential hygiene to sensitive Pi sessions.
---
# Shard security

Use when a project handles credentials, production APIs, private data, or destructive operations.

## Procedure

1. Identify assets, trust boundaries, required network access, and irreversible commands.
2. Prefer an OS sandbox (`bwrap`) with the project writable and unrelated paths read-only.
3. Add project-local deny rules for destructive commands and external side effects.
4. Keep credentials outside prompts and repositories; restrict secret-file permissions.
5. Run the task in dry-run/staging mode before granting production access.
6. Verify denied operations fail and required safe operations still work.

## Boundaries

- lean-ctx handles general shell restrictions; project rules add domain-specific controls.
- Never hard-code one project's paths, vendors, APIs, or credentials in this reusable skill.
- Network isolation and API access are mutually constraining: authorize only the minimum needed route.
