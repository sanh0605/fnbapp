# Notices

How a screen tells the user that something worked, failed, or needs a look. The rest of the screen rules are in `docs/02-rules/business-rules/screens.md`.

### BR-UI-020 — One notice style

**Status:** `APPROVED` — chosen on the owner's behalf under his 2026-10-15 delegation, with the till redo (mockup A). On his end-of-batch review list. Pushed 2026-10-17.

- Every notice that pops up and goes away uses the shared `components/ui/Toast.tsx`: an icon, a bold title, an optional detail line, and a ✕ to close.
- Four kinds, each with its own colour and icon: success (brown), error (red), warning (dark yellow `#9A6700`), info (slate blue `#3B5B7A`).
- Success and info close after 3 seconds, a warning after 5. An error stays until it is closed, so a failed order is never missed.
- At most three notices that are not errors show at once; the oldest goes first. Errors are never pushed out.
- The till uses it from 2026-10-17. Admin pages switch to it as each area is redone; until then they keep their own messages.
