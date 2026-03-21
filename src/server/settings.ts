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

const DEFAULT_LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="180" viewBox="0 0 520 180" fill="none">
  <rect width="520" height="180" rx="24" fill="transparent"/>
  <g transform="translate(0 6)">
    <g fill="#FF5A1F">
      <circle cx="52" cy="54" r="34"/>
      <circle cx="128" cy="54" r="34"/>
      <circle cx="204" cy="54" r="34"/>
      <circle cx="280" cy="54" r="34"/>
    </g>
    <g fill="#050505">
      <path d="M40.4 34h11.7l10.2 28.8L72.5 34h11.2L67 77H56.5L40.4 34Z"/>
      <path d="M115 34h10.8v33.6h20.1V77H115V34Z"/>
      <path d="M199.6 34h11.6L228.5 77h-11.7l-2.9-7.8h-17.1l-2.9 7.8h-11.2l16.9-43Zm11 26.6-5.3-14.3-5.2 14.3h10.5Z"/>
      <path d="M268 34h10.9v16.4h15.5V34h10.9V77h-10.9V60h-15.5v17H268V34Z"/>
    </g>
    <path d="M18 104h321" stroke="rgba(228,238,240,0.16)" stroke-width="1.5"/>
    <g fill="#E4EEF0">
      <path d="M22 119h15.1c6.5 0 10.8 3.4 10.8 8.8 0 4.2-2.3 7-6 8.1l7 12.2H38.8l-5.9-10.8h-1v10.8H22V119Zm14.2 10.7c1.9 0 3.1-.9 3.1-2.5 0-1.7-1.2-2.5-3.1-2.5h-4.3v5h4.3Z"/>
      <path d="M58 119h27.7v7.3H67.8v4.1h15.9v6.8H67.8v4.4h18.1v7.4H58V119Z"/>
      <path d="M95.8 119h10.8l12.5 16.2V119h9.7v30.1h-9.1L105.5 132v17.1h-9.7V119Z"/>
      <path d="M141.3 119h12.6c10.7 0 17.4 5.7 17.4 15 0 9.2-6.7 15.1-17.4 15.1h-12.6V119Zm12.5 22.4c4.6 0 7.6-2.7 7.6-7.4s-3-7.4-7.6-7.4h-2.7v14.8h2.7Z"/>
      <path d="M180.8 119h27.7v7.3h-17.9v4.1h15.9v6.8h-15.9v4.4h18.1v7.4h-27.9V119Z"/>
      <path d="M218.6 119h10.8l12.5 16.2V119h9.7v30.1h-9.1L228.3 132v17.1h-9.7V119Z"/>
      <path d="M264.1 119h12.8c10.3 0 16.3 4.4 16.3 11.8 0 7.4-6 12-16.3 12h-3v6.3h-9.8V119Zm12.7 16.3c3.5 0 5.5-1.5 5.5-4.3 0-2.8-2-4.3-5.5-4.3h-2.9v8.5h2.9Z"/>
      <path d="M302 119h27.7v7.3h-17.9v4.1h15.9v6.8h-15.9v4.4H330v7.4H302V119Z"/>
      <path d="M339.8 119h10.8l12.5 16.2V119h9.7v30.1h-9.1L349.5 132v17.1h-9.7V119Z"/>
      <path d="M385.3 119H398c10.7 0 17.4 5.7 17.4 15 0 9.2-6.7 15.1-17.4 15.1h-12.6V119Zm12.5 22.4c4.6 0 7.6-2.7 7.6-7.4s-3-7.4-7.6-7.4h-2.7v14.8h2.7Z"/>
      <path d="M425 119h9.8v30.1H425V119Z"/>
      <path d="M446.3 119h10.8l12.5 16.2V119h9.7v30.1h-9.1L456 132v17.1h-9.7V119Z"/>
    </g>
  </g>
</svg>
`.trim();

function svgToDataUri(svg: string) {
  return `data:image/svg+xml,${encodeURIComponent(svg).replace(/%0A/g, "").replace(/%20/g, " ")}`;
}

const DEFAULT_LOGO_DATA_URI = svgToDataUri(DEFAULT_LOGO_SVG);

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
  const logoUrl = map.Logo_link?.trim() || DEFAULT_LOGO_DATA_URI;
  const poweredByText = map.PoweredByText?.trim() || "Powered by VLAH ENTERPRISE";
  const resolvedLogoUrl =
    logoUrl.startsWith("data:") || !logoVersion ? logoUrl : `${logoUrl}?v=${encodeURIComponent(logoVersion)}`;

  return {
    title,
    subtitle,
    logoVersion,
    logoUrl: resolvedLogoUrl,
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
