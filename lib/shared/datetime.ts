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

const DAY_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * BR-DATA-006: every date outside a filter shows dd/mm/yyyy HH:mm:ss.
 * A day-only value ("2026-09-28") has no time; it is read as Saigon
 * midnight so it shows 00:00:00 -- `new Date("2026-09-28")` would be UTC
 * midnight, i.e. 07:00:00 in Saigon.
 */
export function formatDateTimeFull(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") {
    const m = DAY_ONLY.exec(value);
    if (m) return `${m[3]}/${m[2]}/${m[1]} 00:00:00`;
  }
  return formatDateTime(value, { withSeconds: true });
}

/** Filter input: "dd/mm/yyyy" (1- or 2-digit day and month) -> "YYYY-MM-DD", or null. */
export function parseVnDay(text: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null;
  return `${m[3]}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function formatVnDay(isoDay: string): string {
  const m = DAY_ONLY.exec(isoDay);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** "YYYY-MM-DD" of the Saigon calendar day that `now` falls on. */
export function saigonToday(now: Date = new Date()): string {
  const p = getSaigonParts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * Long weekday + day for a day-only value, e.g. "Thứ Ba, 15/09/2026".
 * Weekday is computed for the calendar day itself (midnight UTC is 07:00
 * that same day in Saigon), so it never depends on the process zone.
 */
export function formatVnDayWithWeekday(isoDay: string): string {
  const m = DAY_ONLY.exec(isoDay);
  if (!m) return "";
  const probe = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const weekday = probe.toLocaleDateString("vi-VN", { weekday: "long", timeZone: SAIGON_TZ });
  return `${weekday}, ${m[3]}/${m[2]}/${m[1]}`;
}
