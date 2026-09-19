/** Mumbai business logic runs in Asia/Kolkata (IST, UTC+05:30, no DST). */
export const IST_TZ = "Asia/Kolkata";
export const IST_OFFSET_MINUTES = 330;
const IST_OFFSET_SUFFIX = "+05:30";

/** `2026-09-19T20:30` (wall-clock IST) -> ISO UTC instant. Returns null when unparseable. */
export function istLocalToUtcIso(local: string): string | null {
  if (!local) return null;
  const trimmed = local.trim().replace(" ", "T");
  const withSeconds = /T\d{2}:\d{2}$/.test(trimmed) ? `${trimmed}:00` : trimmed;
  const d = new Date(`${withSeconds}${IST_OFFSET_SUFFIX}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO UTC instant -> `YYYY-MM-DDTHH:mm` wall-clock IST, for `datetime-local` inputs. */
export function utcIsoToIstLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() + IST_OFFSET_MINUTES * 60000).toISOString().slice(0, 16);
}

/** `YYYY-MM-DD` calendar day in IST for an instant. */
export function istDayKey(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Date(d.getTime() + IST_OFFSET_MINUTES * 60000).toISOString().slice(0, 10);
}

/** Start/end UTC instants of an IST calendar day. */
export function istDayBounds(day: string): { start: string; end: string } {
  const start = new Date(`${day}T00:00:00${IST_OFFSET_SUFFIX}`);
  const end = new Date(start.getTime() + 86400000);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** The upcoming Sat 00:00 IST -> Mon 00:00 IST window (the current weekend when it's already Sat/Sun). */
export function istWeekendWindow(now: Date = new Date()): { start: string; end: string } {
  const istNow = new Date(now.getTime() + IST_OFFSET_MINUTES * 60000);
  const dow = istNow.getUTCDay(); // 0 Sun .. 6 Sat
  const daysToSat = dow === 6 ? 0 : dow === 0 ? -1 : 6 - dow;
  const satDay = new Date(istNow.getTime() + daysToSat * 86400000).toISOString().slice(0, 10);
  const start = new Date(`${satDay}T00:00:00${IST_OFFSET_SUFFIX}`);
  const end = new Date(start.getTime() + 2 * 86400000);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** "Tonight" = now -> 04:00 IST the next morning. */
export function istTonightWindow(now: Date = new Date()): { start: string; end: string } {
  const day = istDayKey(now);
  const end = new Date(`${day}T00:00:00${IST_OFFSET_SUFFIX}`).getTime() + 28 * 3600000;
  return { start: now.toISOString(), end: new Date(end).toISOString() };
}

export function formatIst(iso: string | null, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", { timeZone: IST_TZ, day: "numeric", month: "short", hour: "numeric", minute: "2-digit", ...opts });
}
