import "server-only";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isValidYmd(year: number, month: number, day: number) {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return false;
  if (year < 1000 || year > 9999) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

export function normalizeIsoDate(value: string | null | undefined): string | null {
  const s = String(value ?? "").trim();
  if (!s) return null;

  // yyyy-mm-dd (allow non-zero-padded month/day)
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const year = Number.parseInt(m[1], 10);
    const month = Number.parseInt(m[2], 10);
    const day = Number.parseInt(m[3], 10);
    if (!isValidYmd(year, month, day)) return null;
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  // yyyy/mm/dd
  m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) {
    const year = Number.parseInt(m[1], 10);
    const month = Number.parseInt(m[2], 10);
    const day = Number.parseInt(m[3], 10);
    if (!isValidYmd(year, month, day)) return null;
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  // dd.mm.yyyy / dd/mm/yyyy / dd-mm-yyyy
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) {
    const day = Number.parseInt(m[1], 10);
    const month = Number.parseInt(m[2], 10);
    const year = Number.parseInt(m[3], 10);
    if (!isValidYmd(year, month, day)) return null;
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  return null;
}

export function isIsoDate(value: string | null | undefined) {
  const s = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && normalizeIsoDate(s) === s;
}

