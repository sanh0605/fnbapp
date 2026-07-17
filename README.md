# FNB App

## Tổng quan

FNB App là hệ thống bán hàng và quản lý vận hành cho một quán đồ uống theo mô hình bán mang đi. Hệ thống hiện phục vụ một thương hiệu tại một điểm bán; hỗ trợ nhiều thương hiệu hoặc nhiều chi nhánh là định hướng tương lai, chưa phải phạm vi đang vận hành.

Ứng dụng bao gồm quầy bán hàng, đơn hàng, sản phẩm và công thức, mua hàng, tồn kho, sản xuất bán thành phẩm, báo cáo, kiểm tra sai lệch dữ liệu và sao lưu.

Danh sách tính năng và mức độ xác minh được quản lý tại [`docs/FEATURE-CATALOG.md`](docs/FEATURE-CATALOG.md). Khả năng bán hàng khi mất mạng chưa được xác minh và không được xem là tính năng đang hoạt động.

## Phạm vi vận hành hiện tại

- Một thương hiệu, một điểm bán đang hoạt động.
- Mô hình phục vụ chính: xe/quầy đồ uống và bán mang đi.
- Dữ liệu bán hàng, tồn kho và báo cáo chính lưu tại Supabase Postgres.
- Giá vốn đơn hàng được chốt tại thời điểm bán và báo cáo theo phương pháp MAC.
- Sao lưu toàn bộ dữ liệu chạy hằng ngày sang Google Drive theo chính sách đã duyệt.

Các kế hoạch mở rộng nhiều chi nhánh, nhượng quyền và bán hàng offline được theo dõi trong [`docs/ROADMAP.md`](docs/ROADMAP.md), không được mô tả là đã hoàn thành.

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

Operational rules are defined in [`docs/BUSINESS-RULES.md`](docs/BUSINESS-RULES.md). Team protocol is defined in [`docs/COLLABORATION.md`](docs/COLLABORATION.md).

## Canonical documentation

| Document | Purpose |
|---|---|
| [`README.md`](README.md) | Product entry point, setup, and documentation map |
| [`CONTEXT.md`](CONTEXT.md) | Current business context and scope |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Runtime architecture and trust boundaries |
| [`docs/FEATURE-CATALOG.md`](docs/FEATURE-CATALOG.md) | Feature inventory and evidence status |
| [`docs/BUSINESS-RULES.md`](docs/BUSINESS-RULES.md) | Approved operating rules and unresolved decisions |
| [`docs/ACCESS-MODEL.md`](docs/ACCESS-MODEL.md) | Intended roles versus observed/verified enforcement |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Pending work and priorities |
| [`docs/COMPLETED.md`](docs/COMPLETED.md) | Completed-outcome index |
| [`docs/TESTING.md`](docs/TESTING.md) | Test strategy, commands, and evidence gates |
| [`docs/COLLABORATION.md`](docs/COLLABORATION.md) | Ownership and coordination protocol |

Detailed policy documents and historical audit evidence remain available under `docs/`; the ten files above are stable entry points, not replacements for immutable evidence.
