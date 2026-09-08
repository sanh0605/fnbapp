#!/usr/bin/env sh
# Stop hook: catch "xong" reported while a gate is red.
#
# Owner decision 2026-09-08. Runs the two fast gates (tsc, vitest) when the turn
# actually touched code, and says so if either fails. It never blocks -- it only
# surfaces. Blocking a turn on a red gate would strand the owner mid-conversation
# with no way to hear why.
#
# The git guard is what keeps this cheap: a turn that only answered a question
# leaves no modified source file, so the hook exits in milliseconds instead of
# spending ~20 seconds on a suite nothing could have broken.
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" || exit 0

# Only source changes can turn a gate red. Docs have their own gates, and those
# are cheap enough to run by hand.
changed=$(git status --porcelain -- '*.ts' '*.tsx' 2>/dev/null | head -1)
if [ -z "$changed" ]; then
  exit 0
fi

failures=""

if ! npx tsc --noEmit >/tmp/claude-stop-tsc.log 2>&1; then
  failures="tsc --noEmit"
fi

# Only worth running the suite if the types hold; a type error fails it anyway.
if [ -z "$failures" ]; then
  if ! npx vitest run >/tmp/claude-stop-vitest.log 2>&1; then
    tail=$(grep -E "Tests +[0-9]+ failed|FAIL" /tmp/claude-stop-vitest.log | head -3 | tr '\n' ' ')
    failures="vitest run -- ${tail:-see /tmp/claude-stop-vitest.log}"
  fi
fi

if [ -n "$failures" ]; then
  printf '%s' "{\"systemMessage\": \"[stop-gate] Cua do voi file .ts/.tsx dang sua: $failures. Dung bao xong khi cua con do.\"}"
fi

exit 0
