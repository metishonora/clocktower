# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root.
- **[`DOMAIN_MODEL.md`](../../DOMAIN_MODEL.md)** for shared concepts, relationships, and state ownership.
- **[`ARCHITECTURE.md`](../../ARCHITECTURE.md)** for implementation responsibilities and contracts.
- **`docs/adr/`** for ADRs that touch the area you're about to work in, if present.

If these files don't exist, proceed silently. The domain-modeling flow creates them lazily when terms or decisions actually get resolved.

## File structure

This is a single-context repo:

```text
/
├── CONTEXT.md
├── DOMAIN_MODEL.md
├── ARCHITECTURE.md
├── docs/adr/
├── crates/domain/src/
└── web/src/
```

## Use the glossary's vocabulary

When output names a domain concept, use the term as defined in `CONTEXT.md`. Do not drift to synonyms the glossary explicitly avoids.

Use `DOMAIN_MODEL.md` for expanded meanings and boundaries. In particular, distinguish Action
definition, Action occurrence, and Step; reserve Execution for the existing game term.
Distinguish the broader conceptual model, the implemented Issue #206 custom first-night runtime,
and an approved issue spec. Use `ARCHITECTURE.md` for the implementation paths and responsibilities;
the custom runtime does not imply changes to official runtimes or expand issue scope.

If the concept you need isn't in the glossary yet, either reconsider the term or note it for domain modeling.

## Flag ADR conflicts

If output contradicts an existing ADR, surface it explicitly rather than silently overriding.
