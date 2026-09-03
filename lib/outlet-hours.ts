// Pure logic for whether an outlet is open at a given Saigon time.
// section 2.
//
// Deliberately takes "now" as a plain "HH:MM" string rather than reading
// the clock itself, so it is testable with a fixed clock instead of the
// machine's own time (plan section 5) -- the caller (a client component)
// derives that string via Intl with an explicit Asia/Ho_Chi_Minh
// timeZone, never the runtime's local zone (OPEN-ITEMS 57 and the sales-
// chart timezone bug are both that exact mistake, made twice already).

// Accepts "HH:MM" (from an <input type="time">) or "HH:MM:SS" (Postgres
// time's own serialization) -- only the first two fields matter here.
function toMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

// Null on either bound means no stated hours -- never mark the outlet
// closed on incomplete data (plan section 5: "Null hours never mark an
// outlet closed").
export function isOutletOpenAt(
  openTime: string | null | undefined,
  closeTime: string | null | undefined,
  nowHHMM: string,
): boolean {
  if (!openTime || !closeTime) return true;

  const open = toMinutes(openTime);
  const close = toMinutes(closeTime);
  const now = toMinutes(nowHHMM);
  if (open === null || close === null || now === null) return true;

  // Equal bounds is a data-entry mistake, not a real zero-width window --
  // treat as unset rather than permanently closed.
  if (open === close) return true;

  if (open < close) {
    return now >= open && now < close;
  }
  // Overnight window, e.g. 17:00 - 02:00.
  return now >= open || now < close;
}

const SAIGON_TZ = "Asia/Ho_Chi_Minh";

// The real current time, explicit Asia/Ho_Chi_Minh -- never the runtime's
// own local zone, the exact mistake OPEN-ITEMS 57 and the sales-chart
// timezone bug both made. Not unit-tested itself (it wraps Date.now()),
// same as lib/report-time.ts's saigonBucketKeys -- callers pass the result
// into isOutletOpenAt above, which is the part proven with a fixed clock.
export function getSaigonNowHHMM(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAIGON_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find(p => p.type === type)?.value || "00";
  let hour = get("hour");
  if (hour === "24") hour = "00"; // some runtimes emit 24 for midnight
  return `${hour}:${get("minute")}`;
}
