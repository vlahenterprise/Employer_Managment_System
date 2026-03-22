export type OnboardingResourceLink = {
  label: string;
  url: string;
};

export function normalizeOnboardingLinks(value: unknown): OnboardingResourceLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const candidate = row as Record<string, unknown>;
      const label = String(candidate.label ?? "").trim();
      const url = String(candidate.url ?? "").trim();
      if (!url) return null;
      return {
        label: label || deriveLinkLabel(url),
        url
      };
    })
    .filter((row): row is OnboardingResourceLink => Boolean(row));
}

export function parseOnboardingLinksInput(value: string | null | undefined): OnboardingResourceLink[] {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const [labelRaw, urlRaw] = row.includes("|") ? row.split("|", 2) : ["", row];
      const label = String(labelRaw ?? "").trim();
      const url = String(urlRaw ?? "").trim();
      if (!url || !isProbablyUrl(url)) return null;
      return {
        label: label || deriveLinkLabel(url),
        url
      };
    })
    .filter((row): row is OnboardingResourceLink => Boolean(row));
}

export function serializeOnboardingLinksInput(links: unknown) {
  return normalizeOnboardingLinks(links)
    .map((link) => `${link.label} | ${link.url}`)
    .join("\n");
}

export function buildOnboardingDueDate(startDate: Date | null | undefined, dueOffsetDays: number | null | undefined) {
  if (!startDate || dueOffsetDays == null || Number.isNaN(dueOffsetDays)) return null;
  const base = new Date(startDate);
  if (Number.isNaN(base.getTime())) return null;
  base.setDate(base.getDate() + dueOffsetDays);
  return base;
}

export function isOnboardingPhaseReadyForClose(item: {
  isCompleted: boolean;
  hrConfirmationRequired?: boolean | null;
  managerConfirmationRequired?: boolean | null;
  hrConfirmedAt?: Date | null;
  managerConfirmedAt?: Date | null;
}) {
  if (!item.isCompleted) return false;
  if (item.hrConfirmationRequired !== false && !item.hrConfirmedAt) return false;
  if (item.managerConfirmationRequired !== false && !item.managerConfirmedAt) return false;
  return true;
}

function deriveLinkLabel(url: string) {
  try {
    const parsed = new URL(url);
    const lastSegment = parsed.pathname.split("/").filter(Boolean).at(-1);
    return lastSegment || parsed.hostname;
  } catch {
    return "Drive link";
  }
}

function isProbablyUrl(value: string) {
  try {
    const parsed = new URL(value);
    return Boolean(parsed.protocol && parsed.hostname);
  } catch {
    return false;
  }
}
