# A point-and-comment tool on the local preview

**Written 2026-08-26 by Opus 5**, from the owner's own written specification.
Handoff to Sonnet 5. Critique before coding (`CLAUDE.md` §1), in particular §4's
choice of element fingerprint and §6's claim about how the production build is
kept clean.

**This is the first work under the revised UI rule** (`CLAUDE.md` §7, revised
2026-08-26): each device gets its own layout, neither a squeezed version of the
other. The tool exists so the owner can say *"this is wrong on the phone"* by
pointing at it, instead of describing it in words and hoping.

---

## 1. What the project actually is

Surveyed rather than assumed: **Next.js 14.2.3** (App Router), **React 18**,
**Tailwind 3.4**, TypeScript 5, Vitest 4. `package.json`'s `dev` script is a
bare `next dev` — no host flag, so a phone on the same wifi cannot reach it
today. Root layout is `app/layout.tsx`, `<body>` wrapping `{children}`.

There is no `.claude/commands/` directory yet; the slash command in §7 creates
the first one.

## 2. The experience the owner asked for, verbatim in intent

**Previewing:** one simple command starts the preview, reachable both on the
machine and from a phone on the same wifi. Editing anything reloads the page
**keeping the scroll position** rather than jumping to the top.

**Commenting:** a **"Góp ý"** button on the preview. Press it, click the thing
that is wrong, type a few lines, save. The tool remembers *which part of the
page* was pointed at so the source can be found later without hunting. A
**general comment** with no element attached is also possible. The list of
comments can be reviewed and items deleted. **The comment UI must not bleed into
or affect the real page.**

**Fixing:** all comments collect into one readable file at the project root. A
**slash command** reads them, finds the right places in the source, makes the
changes, clears the queue and reports briefly what changed.

**Boundaries, non-negotiable:** local preview only, **never in the deployed
build**, and the comment files are the owner's own — **not committed**.

## 3. Preview and reload

- Add a script — `npm run preview` — running `next dev -H 0.0.0.0`, and print
  the LAN address so the owner can type it into a phone. Find the address at
  runtime; do not hard-code one.
- **Leave `npm run dev` exactly as it is.** Other work depends on it.
- **Scroll position:** Next's Fast Refresh already preserves it for a component
  edit; a full reload does not. Persist `scrollY` to `sessionStorage` on unload
  and restore it after hydration. Restore **once**, and only if the stored value
  is for the same path — restoring a stale offset onto a different page is worse
  than jumping to the top.

## 4. Identifying what was clicked

This is the part that decides whether the slash command in §7 can actually find
the code, so it is worth more thought than the UI.

Record for each comment, at minimum:

- a **CSS selector path** from `<body>` to the clicked element;
- its **`className`** — in a Tailwind project the class string is often unique
  enough to grep for directly, which is the cheapest possible way back to the
  source;
- the first ~80 characters of its **`textContent`** — Vietnamese UI text is
  highly distinctive and greps well;
- the **route** (`window.location.pathname`) and the **viewport width**, since
  under the new rule the same route has two layouts and a comment about one is
  not a comment about the other.

**Propose a better fingerprint if you find one** — for instance whether this
Next version emits anything usable in dev that survives to the DOM. Check before
assuming; do not add a Babel or SWC plugin for it without saying what it costs.

## 5. The comment UI must not touch the page

The owner's own condition. Requirements, not suggestions:

- Render the toolbar and the overlay **outside the app tree** — a React portal
  into a container appended to `<body>`, not nested inside `{children}`.
- **No Tailwind classes on the overlay.** Tailwind's classes are the page's own
  vocabulary; reusing them invites a stray global style to change the page. Use
  inline styles or a scoped stylesheet.
- A very high `z-index`, and `pointer-events` disabled on the overlay except
  while picking, so the page stays usable with the tool loaded.
- Picking mode highlights the hovered element with an outline drawn **in the
  overlay**, not by mutating the element's own style.

## 6. It must not reach production

Two independent guards, because one is a single point of failure:

1. **The import is conditional.** In `app/layout.tsx`, render it only when
   `process.env.NODE_ENV !== "production"`. Next tree-shakes the branch, so the
   component never enters the production bundle.
2. **The API route that writes the file refuses outside development** — return
   404 when `NODE_ENV === "production"`, so even if the client somehow shipped,
   it can write nothing.

**Verify the first guard by evidence, not by reading:** run `npm run build` and
show that the tool's bundle does not appear in the route output, or grep the
built output for a string unique to the toolbar. "It should be tree-shaken" is
not a verification.

## 7. Storage and the slash command

- Comments land in **`UI-FEEDBACK.md`** at the project root — a human-readable
  list, newest last, each entry carrying the route, viewport, selector,
  className, text snippet and the owner's note.
- **Add it to `.gitignore`.** The owner said these are his own and not for the
  repository.
- Writing happens through a **dev-only API route**, since the browser cannot
  write files.
- The slash command goes in `.claude/commands/` — create the directory. It must:
  read `UI-FEEDBACK.md`, locate each target in the source, make the change,
  **empty the queue only for the entries it actually fixed**, and report briefly
  in Vietnamese what changed. An entry it could not act on stays in the file
  with a note saying why; silently dropping it would lose the owner's words.

## 8. Verification

- **Rendered tests** for the toolbar: it mounts, picking mode records a
  selector, a general comment saves with no element, an entry can be deleted.
- **A test that the overlay is portalled outside the app tree**, not nested in
  the page — the owner's non-interference condition, asserted rather than
  assumed.
- **The production-build evidence from §6.**
- The API route returns 404 with `NODE_ENV=production`.
- `.gitignore` covers the feedback file — prove it with `git check-ignore`.
- `CLAUDE.md` §9's four gates. Do not push.

## 9. Deliberately out of scope

Screenshots, drawing on the page, multi-user comments, and any storage other
than the one file. The owner asked for a way to point and type; anything past
that is invention.

## 10. Done means

`CLAUDE.md` §9 in full, plus §8, plus **a short Vietnamese note telling the
owner how to start it and how to use it** — he asked for that explicitly, and it
is part of the deliverable rather than a courtesy.
