#!/usr/bin/env sh
# SessionStart hook: put "where are we" into context from sources that cannot
# go stale -- git and the machine-generated open-items file. Kept short: every
# line here costs context in every session.
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" || exit 0
echo "[session-start] Branch: $(git branch --show-current 2>/dev/null)"
echo "[session-start] Last 10 commits:"
git log --oneline -10 2>/dev/null
echo "[session-start] Working tree: $(git status --short 2>/dev/null | wc -l | tr -d ' ') changed file(s)"
echo "[session-start] Open items (docs/04-operations/OPEN-ITEMS.md):"
sed -n '3,$p' docs/04-operations/OPEN-ITEMS.md 2>/dev/null
exit 0
