# AGENTS.md — FNB App

This repo uses both Claude Code and Codex CLI. Follow the same rules regardless of which agent is running.

## Read first (every session)

1. `docs/COLLABORATION.md` — protocol, file map, status markers, commit conventions
2. `CLAUDE.md` — project-specific coding rules (applies to Codex too)
3. `DEVELOPMENT-TRACKING.md` — 3 newest entries (chronicle log)
4. `docs/audits/codex-handoff-2026-06-25.md` — active task tracking
5. `docs/audits/2026-06-25-full-system-audit-roadmap.md` — phase status

## Communication

- Commit prefix: `Claude:` or `Codex:` + type (`fix:`/`feat:`/`chore:`/`docs:`).
- Status markers in handoff: `[ ]` `[x]` `[~]` `[!]` `[-]`.
- After every change: append entry to `DEVELOPMENT-TRACKING.md` (newest first).
- Do not push unless explicitly asked.

## Coding rules

Same as `CLAUDE.md`:
- Code/comments: English only
- User-facing strings: Vietnamese
- CamelCase, no new emojis
- Surgical changes, simplicity first
- Transactions for critical flows
- Use Lodash when applicable
- Follow `docs/domain-dictionary.md` for terminology
