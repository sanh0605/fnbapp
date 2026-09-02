# System map (hand-drawn overview)

Concise map for humans. The full machine-derived map lives in
`docs/generated/system-map.md` (do not hand-edit that one).

Note: `lib/sheets_db.ts` is the DB adapter — the name says Google Sheets but the
implementation is Supabase (spec §3.2c).

## Stock-issue write relations

```relations
lib/manual-issue-transaction.ts -> issue_slips (write)
lib/manual-issue-transaction.ts -> stock_issues (write)
```
