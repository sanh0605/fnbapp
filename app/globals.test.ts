import { describe, it } from "vitest";

describe("heading font", () => {
  // Deferred until the owner picks a replacement (decision 2026-09-12).
  // Places to change when this is done:
  // - the Google Fonts @import on line 1 of app/globals.css
  // - the `h1, h2, h3` font-family rule in the @layer base block of app/globals.css
  // - `fontFamily.display` in tailwind.config.ts
  // Warning: POS product names use `<h3 line-clamp-2>` in app/pos/, so a wider
  // font can push long names past the clamp -- the owner must look at the POS
  // screen after the switch, not just the reports pages.
  it.todo(
    "Đổi font tiêu đề và số lớn toàn hệ thống từ Outfit sang một font có đủ dấu tiếng Việt (ví dụ Be Vietnam Pro, Lexend) — dựng bản thử cho chủ quán so trước; lúc làm hỏi rõ đổi cả chữ thường hay chỉ tiêu đề (chủ quán chốt 12/09/2026)",
  );
});
