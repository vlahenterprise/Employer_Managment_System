import { unstable_cache } from "next/cache";
import { SETTINGS_CACHE_TAG } from "./cache-tags";
import { prisma } from "./db";

export const THEME_SETTING_KEYS = [
  "MainColor",
  "SecondaryColor",
  "MainFontColor",
  "SecondaryFontColor",
  "Dark1",
  "Dark2",
  "Light1",
  "Light2",
  "AccentBlue",
  "AccentGold",
  "AccentTeal",
  "AccentCyan",
  "AccentAmber",
  "DangerColor",
  "OkColor",
  "LogoSize",
  "PageMaxWidth"
] as const;

export const BRANDING_SETTING_KEYS = ["AppTitle", "AppSubtitle", "Logo_link", "LogoVersion", "PoweredByText"] as const;

const getAllSettingsRowsCached = unstable_cache(
  async () =>
    prisma.setting.findMany({
      select: { key: true, value: true }
    }),
  ["settings:rows"],
  { tags: [SETTINGS_CACHE_TAG] }
);

function safeHexColor(value: string | undefined | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (
    /^#[0-9a-fA-F]{3}$/.test(trimmed) ||
    /^#[0-9a-fA-F]{4}$/.test(trimmed) ||
    /^#[0-9a-fA-F]{6}$/.test(trimmed) ||
    /^#[0-9a-fA-F]{8}$/.test(trimmed)
  ) {
    return trimmed;
  }
  return null;
}

function hexToRgbTriplet(hexColor: string) {
  const hex = hexColor.replace("#", "");
  const normalized =
    hex.length === 3 || hex.length === 4
      ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
      : hex.length === 6 || hex.length === 8
        ? hex.slice(0, 6)
        : null;

  if (!normalized) return null;

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return `${r} ${g} ${b}`;
}

export async function getSettingsMap(keys: readonly string[]) {
  const map = await getAllSettingsMap();
  const selected: Record<string, string> = {};
  for (const key of keys) {
    if (map[key] != null) selected[key] = map[key];
  }
  return selected;
}

export async function getAllSettingsMap() {
  const rows = await getAllSettingsRowsCached();
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return map;
}

export async function getBrandingSettings() {
  const map = await getSettingsMap(BRANDING_SETTING_KEYS);
  const title = map.AppTitle?.trim() || "Employer Management System";
  const subtitle = map.AppSubtitle?.trim() || "Internal HR and operations platform";
  const logoVersion = map.LogoVersion?.trim() || "";
  const logoUrl = map.Logo_link?.trim() || "";
  const poweredByText = map.PoweredByText?.trim() || "Powered by VLAH ENTERPRISE";

  return {
    title,
    subtitle,
    logoVersion,
    logoUrl: logoUrl && logoVersion ? `${logoUrl}?v=${encodeURIComponent(logoVersion)}` : logoUrl,
    poweredByText
  };
}

export async function getThemeCssVars() {
  const map = await getSettingsMap(THEME_SETTING_KEYS);

  // Defaults match the legacy Apps Script version (Verzija 2)
  const mainColor = safeHexColor(map.MainColor) ?? "#050505";
  const secondaryColor = safeHexColor(map.SecondaryColor) ?? "#F05123";
  const mainFontColor = safeHexColor(map.MainFontColor) ?? "#E4EEF0";
  const secondaryFontColor = safeHexColor(map.SecondaryFontColor) ?? "#A0A7A8";
  const dark1 = safeHexColor(map.Dark1) ?? "#0B0B0B";
  const dark2 = safeHexColor(map.Dark2) ?? "#161616";
  const light1 = safeHexColor(map.Light1) ?? "#E4EEF0";
  const light2 = safeHexColor(map.Light2) ?? "#C6CCCD";
  const accentBlue = safeHexColor(map.AccentBlue) ?? "#5252ff";
  const accentGold = safeHexColor(map.AccentGold) ?? "#E9C46A";
  const accentTeal = safeHexColor(map.AccentTeal) ?? "#264653";
  const accentCyan = safeHexColor(map.AccentCyan) ?? "#8ecae6";
  const accentAmber = safeHexColor(map.AccentAmber) ?? "#ffb703";
  const dangerColor = safeHexColor(map.DangerColor) ?? "#C62828";
  const okColor = safeHexColor(map.OkColor) ?? "#1e8e6a";
  const logoSizeRaw = Number(map.LogoSize);
  const pageMaxWidthRaw = Number(map.PageMaxWidth);
  const logoSize = Number.isFinite(logoSizeRaw) && logoSizeRaw > 40 ? `${logoSizeRaw}px` : "150px";
  const pageMaxWidth = Number.isFinite(pageMaxWidthRaw) && pageMaxWidthRaw > 900 ? `${pageMaxWidthRaw}px` : "1320px";

  return {
    "--color-main": mainColor,
    "--color-secondary": secondaryColor,
    "--color-secondary-rgb": hexToRgbTriplet(secondaryColor) ?? "240 81 35",
    "--color-font-main": mainFontColor,
    "--color-font-secondary": secondaryFontColor,
    "--color-dark-1": dark1,
    "--color-dark-1-rgb": hexToRgbTriplet(dark1) ?? "11 11 11",
    "--color-dark-2": dark2,
    "--color-dark-2-rgb": hexToRgbTriplet(dark2) ?? "22 22 22",
    "--color-light-1": light1,
    "--color-light-1-rgb": hexToRgbTriplet(light1) ?? "228 238 240",
    "--color-light-2": light2,
    "--color-light-2-rgb": hexToRgbTriplet(light2) ?? "198 204 205",
    "--color-accent-blue": accentBlue,
    "--color-accent-blue-rgb": hexToRgbTriplet(accentBlue) ?? "82 82 255",
    "--color-accent-gold": accentGold,
    "--color-accent-gold-rgb": hexToRgbTriplet(accentGold) ?? "233 196 106",
    "--color-accent-teal": accentTeal,
    "--color-accent-teal-rgb": hexToRgbTriplet(accentTeal) ?? "38 70 83",
    "--color-accent-cyan": accentCyan,
    "--color-accent-cyan-rgb": hexToRgbTriplet(accentCyan) ?? "142 202 230",
    "--color-accent-amber": accentAmber,
    "--color-accent-amber-rgb": hexToRgbTriplet(accentAmber) ?? "255 183 3",
    "--color-danger": dangerColor,
    "--color-danger-rgb": hexToRgbTriplet(dangerColor) ?? "198 40 40",
    "--color-ok": okColor,
    "--color-ok-rgb": hexToRgbTriplet(okColor) ?? "30 142 106",
    "--logo-size": logoSize,
    "--page-max-width": pageMaxWidth
  } as const;
}

export function buildChartPalette(themeVars: Record<string, string | undefined>) {
  const get = (key: string, fallback: string) => {
    const value = themeVars[key];
    return typeof value === "string" && value.trim().length ? value.trim() : fallback;
  };

  return [
    get("--color-secondary", "#F05123"),
    get("--color-accent-amber", "#FFB703"),
    get("--color-accent-blue", "#5252FF"),
    get("--color-accent-cyan", "#8ECAE6"),
    get("--color-accent-gold", "#E9C46A"),
    get("--color-accent-teal", "#264653"),
    get("--color-ok", "#1E8E6A"),
    get("--color-danger", "#C62828"),
    get("--color-light-2", "#C6CCCD"),
    get("--color-font-secondary", "#A0A7A8"),
    get("--color-secondary", "#F05123")
  ];
}
