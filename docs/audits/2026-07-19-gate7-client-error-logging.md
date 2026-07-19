# Gate 7 Client Error Logging

> Tóm tắt tiếng Việt: Hai trang chặn lỗi phía trình duyệt giờ gửi một bản ghi lỗi đã giới hạn trường dữ liệu về API cùng nguồn. API chỉ nhận phiên đăng nhập hợp lệ và ghi bản ghi có cấu trúc vào Vercel server logs. Cơ chế này không thêm secret, dịch vụ trả phí hoặc bảng database.

## Decision

Gate 7 uses an authenticated same-origin endpoint rather than Telegram, a third-party error SDK, or a new database table:

1. `app/error.tsx` reports `global-error` failures.
2. `app/global-error.tsx` reports `root-global-error` failures.
3. `POST /api/client-errors` requires an existing authenticated session.
4. The endpoint writes one structured `[ClientError]` record to server logs.

This closes the prior visibility gap where a browser crash disappeared after the affected tab closed. It does not claim to identify the root cause of `PROD-BUG-1`; the first production record remains the evidence needed for that diagnosis.

## Payload and safety boundaries

Only these bounded fields are accepted:

| Field | Maximum | Purpose |
|---|---:|---|
| `source` | fixed enum | Distinguishes the segment and root error boundaries |
| `message` | 1,000 characters | Error summary |
| `stack` | 8,000 characters | Browser stack trace |
| `digest` | 256 characters | Next.js error digest when supplied |
| `url` | 2,048 characters | Page on which the boundary rendered |
| `timestamp` | valid timestamp | Browser observation time |

Unknown fields are discarded. Empty or malformed payloads return HTTP 400. Unauthenticated requests return HTTP 401 and do not create a diagnostic record. A browser session suppresses duplicate reports with the same source, error details, and URL. Reporting failures are swallowed so the reporting path cannot recursively trigger another error boundary.

The server record adds the resolved actor (`id`, `name`, `role`) and `receivedAt`. It does not contain credentials, session tokens, request headers, or database rows.

## Operator retrieval

1. Open the Vercel project Runtime Logs for the affected time window, or use the repository's existing `vercel logs` workflow.
2. Search for the exact prefix `[ClientError]`.
3. Filter by `receivedAt`, actor, URL, or error digest.
4. Preserve the complete JSON record when opening or updating the incident.

Vercel log retention is the durability limit of this lightweight mechanism. If retention or alert routing becomes insufficient, that is a separate operations decision; it must not silently introduce a paid service or a new production secret.

## Verification

- Payload normalization and bounds: unit tested.
- Serialization and network-failure isolation: unit tested.
- Same-session duplicate suppression: unit tested.
- Unauthenticated and malformed request rejection: route tested.
- Authenticated structured server record: route tested.
- Both error boundaries wired to their distinct sources: contract tested.
- Database writes: none.
- New secrets or external services: none.
- Backup schema impact: none.
