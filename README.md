# FNB App

## Tổng quan

FNB App là hệ thống bán hàng và quản lý vận hành cho một quán đồ uống bán mang
đi. Bối cảnh kinh doanh, mô hình đang vận hành và phạm vi hiện tại — kể cả
những gì **chưa** thuộc phạm vi — nằm ở [`CONTEXT.md`](CONTEXT.md), là tài liệu
chính thống cho phần đó.

Tài liệu này chỉ nói cách chạy và vận hành hệ thống.

## Technical stack

- Next.js 14, React 18, TypeScript, and Tailwind CSS.
- NextAuth Credentials for application sessions; credentials are checked against user data stored in Supabase Postgres.
- Supabase Postgres, RPCs, migrations, and Edge Functions. The current repository does not establish active Supabase Auth or Supabase Storage usage.
- Vercel production deployment.
- Google Apps Script and Google Drive for scheduled full-database snapshots.
- Vitest, fast-check, and jsdom for automated tests.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for boundaries and [`docs/ACCESS-MODEL.md`](docs/ACCESS-MODEL.md) for intended versus verified access rules.

## Local setup

### Prerequisites

- Node.js compatible with Next.js 14.
- npm.
- Access to the approved development environment values. Never copy production secrets into documentation or commit them to Git.

### Commands

```bash
npm install
npm run dev
npm test
npx tsc --noEmit
npm run build
```

### Environment variable names

The application server requires these names for its primary runtime paths:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` or the legacy fallback `SUPABASE_SERVICE_ROLE_KEY`
- `NEXTAUTH_SECRET`

Additional integration or maintenance paths may require:

- `SUPABASE_ANON_KEY`
- `GOOGLE_SPREADSHEET_ID`
- `GOOGLE_CREDENTIALS_BASE64`
- `BACKUP_PULL_TOKEN` in the deployed backup Edge Function
- Apps Script properties documented in the backup runbook

Use the current secret manager or approved local `.env.local`. Do not place secret values in issues, audit documents, screenshots, or commits.

## Safety and production operations

- Read-only inspection does not authorize production writes.
- Any historical data correction requires an approved plan, dry-run, atomic apply path, verification, and rollback evidence.
- Database schema changes use reviewed Supabase migrations; do not edit production structure manually.
- Backup success does not authorize a restore. Restore operations require a separate reviewed plan and verification.
- Do not push local commits unless the owner explicitly asks.

Operational rules are defined in [`docs/BUSINESS-RULES.md`](docs/BUSINESS-RULES.md). Team protocol is defined in [`CLAUDE.md`](CLAUDE.md).

## Canonical documentation

`CLAUDE.md` section 10 is the map — it lists every living document and what each
one is for. It is kept honest by `scripts/check-rules-current.ts`, which fails
the commit if it names a path that no longer exists.
