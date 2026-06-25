/**
 * Date/time formatting helpers — Asia/Saigon timezone, vi-VN locale.
 *
 * Why: Without forcing `timeZone: "Asia/Ho_Chi_Minh"`, server-side render
 * uses the deploy server's local timezone — causing displayed hours to drift
 * from Vietnamese business hours. This helper centralizes the format.
 *
 * Claude code — UI-1/UI-2 fix.
 */

const SAIGON_TZ = "Asia/Ho_Chi_Minh";

function getSaigonParts(d: Date): { day: string; month: string; year: string; hour: string; minute: string; second: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAIGON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find(p => p.type === type)?.value || "00";
  let hour = get("hour");
  if (hour === "24") hour = "00"; // some runtimes emit 24 for midnight
  return {
    day: get("day"),
    month: get("month"),
    year: get("year"),
    hour,
    minute: get("minute"),
    second: get("second"),
  };
}

export interface FormatDateTimeOptions {
  withSeconds?: boolean;
  withDate?: boolean;
}

export function formatDateTime(iso: string | Date, opts: FormatDateTimeOptions = {}): string {
  const { withSeconds = false, withDate = true } = opts;
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";

  const p = getSaigonParts(d);
  const time = withSeconds ? `${p.hour}:${p.minute}:${p.second}` : `${p.hour}:${p.minute}`;
  return withDate ? `${p.day}/${p.month}/${p.year} ${time}` : time;
}

export function formatDate(iso: string | Date): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  const p = getSaigonParts(d);
  return `${p.day}/${p.month}/${p.year}`;
}

export function formatTime(iso: string | Date, withSeconds = false): string {
  return formatDateTime(iso, { withDate: false, withSeconds });
}

/**
 * Convert a Date to ISO-like string in Asia/Saigon local time.
 * Returns `YYYY-MM-DDTHH:mm:ss` representing Saigon wall-clock.
 * Use this for FormData submission where server expects local interpretation.
 */
export function toSaigonIsoString(d: Date): string {
  const p = getSaigonParts(d);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}
