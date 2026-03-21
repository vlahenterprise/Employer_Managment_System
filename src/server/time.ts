type DateLike = Date | string | number;

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function pad(value: number, size = 2) {
  return String(value).padStart(size, "0");
}

function toDate(value: DateLike) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid date value: ${String(value)}`);
  }
  return date;
}

function getFormatter(timeZone: string) {
  const key = `gregory:${timeZone}`;
  const cached = formatterCache.get(key);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    calendar: "gregory",
    numberingSystem: "latn",
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  formatterCache.set(key, formatter);
  return formatter;
}

function getZonedParts(value: DateLike, timeZone: string): ZonedParts {
  const parts = getFormatter(timeZone).formatToParts(toDate(value));
  const mapped = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  ) as Record<string, number>;

  return {
    year: mapped.year,
    month: mapped.month,
    day: mapped.day,
    hour: mapped.hour,
    minute: mapped.minute,
    second: mapped.second
  };
}

export function formatInTimeZone(value: DateLike, timeZone: string, pattern: string) {
  const parts = getZonedParts(value, timeZone);

  if (pattern === "yyyy-MM-dd") {
    return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`;
  }

  if (pattern === "yyyy-MM-dd HH:mm") {
    return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}`;
  }

  throw new Error(`Unsupported time format pattern: ${pattern}`);
}

function parseLocalDateTime(value: string) {
  const match = value
    .trim()
    .match(
      /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/
    );

  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
    millisecond: Number((match[7] ?? "0").padEnd(3, "0"))
  };
}

export function fromZonedTime(value: DateLike, timeZone: string) {
  if (typeof value !== "string") {
    return toDate(value);
  }

  const parsed = parseLocalDateTime(value);
  if (!parsed) {
    return toDate(value);
  }

  const guessUtc = Date.UTC(parsed.year, parsed.month - 1, parsed.day, parsed.hour, parsed.minute, parsed.second, 0);
  const resolved = getZonedParts(guessUtc, timeZone);
  const resolvedUtc = Date.UTC(
    resolved.year,
    resolved.month - 1,
    resolved.day,
    resolved.hour,
    resolved.minute,
    resolved.second,
    0
  );
  const offsetDelta = resolvedUtc - guessUtc;

  return new Date(guessUtc - offsetDelta + parsed.millisecond);
}
