#!/bin/sh
# PreToolUse(Bash) guard: refuse destructive SQL sent through a database client.
#
# Scope, deliberately narrow so read-only work is never blocked:
#   - Only fires when the command invokes a SQL client (psql / supabase db /
#     mysql). A `grep "delete from"` or a file read is therefore untouched.
#   - Blocks DROP TABLE, TRUNCATE TABLE, and DELETE FROM with no WHERE clause.
#
# What it cannot see, stated so nobody mistakes this for full coverage:
#   - SQL the owner runs by hand in the Supabase dashboard.
#   - SQL embedded in a script the agent executes; that path is covered by the
#     --apply reminder hook plus per-run owner approval (CLAUDE.md section 3).
#
# Exit 2 blocks the call and returns stderr to the agent.

input=$(cat)
lower=$(printf '%s' "$input" | tr '[:upper:]' '[:lower:]')

# Not a database client call -> nothing to guard.
case "$lower" in
  *psql*|*"supabase db"*|*mysql*) ;;
  *) exit 0 ;;
esac

blocked=""
case "$lower" in
  *"drop table"*)     blocked="DROP TABLE" ;;
  *"truncate table"*) blocked="TRUNCATE TABLE" ;;
esac

if [ -z "$blocked" ]; then
  case "$lower" in
    *"delete from"*)
      case "$lower" in
        *where*) ;;
        *) blocked="DELETE FROM khong co WHERE" ;;
      esac
      ;;
  esac
fi

if [ -n "$blocked" ]; then
  printf 'CHAN: lenh chua %s.\nLuat fnbapp (CLAUDE.md muc 3): khong xoa du lieu goc, chi danh dau ngung dung.\nNeu that su can thi chu quan duyet tung lan va tu chay, agent khong chay.\n' "$blocked" >&2
  exit 2
fi

exit 0
