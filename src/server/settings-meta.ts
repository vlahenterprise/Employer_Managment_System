import "server-only";

import type { Lang } from "@/i18n";

export type SettingInputType = "text" | "number" | "time" | "color" | "url" | "boolean";

export type SettingGroup =
  | "Branding"
  | "Theme"
  | "DailyReports"
  | "Tasks"
  | "Absence"
  | "Performance"
  | "Backup"
  | "Advanced";

export type SettingMeta = {
  key: string;
  group: SettingGroup;
  type: SettingInputType;
  label: Record<Lang, string>;
  description: Record<Lang, string>;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
};

export const KNOWN_SETTINGS: SettingMeta[] = [
  {
    key: "AppTitle",
    group: "Branding",
    type: "text",
    label: { sr: "Naziv aplikacije", en: "App title" },
    description: { sr: "Glavni naslov u headeru i na dashboardu.", en: "Main title shown in header and dashboard." },
    placeholder: "VLAH ENTERPRISE"
  },
  {
    key: "AppSubtitle",
    group: "Branding",
    type: "text",
    label: { sr: "Podnaslov", en: "Subtitle" },
    description: { sr: "Kratak opis ispod naslova.", en: "Short description under the title." },
    placeholder: "Employer System"
  },
  {
    key: "Logo_link",
    group: "Branding",
    type: "url",
    label: { sr: "Logo link", en: "Logo link" },
    description: {
      sr: "URL logotipa (podržan i Google Drive link). Koristi se u headeru i PDF exportima.",
      en: "Logo URL (Google Drive links supported). Used in header and PDF exports."
    },
    placeholder: "https://..."
  },
  {
    key: "LogoVersion",
    group: "Branding",
    type: "text",
    label: { sr: "Logo verzija", en: "Logo version" },
    description: {
      sr: "Cache-busting parametar (npr. 2026-02-03-2). Promeni kad menjaš logo.",
      en: "Cache-busting version (e.g. 2026-02-03-2). Change when you update the logo."
    },
    placeholder: "2026-02-03-2"
  },
  {
    key: "LogoSize",
    group: "Branding",
    type: "number",
    label: { sr: "Logo veličina (px)", en: "Logo size (px)" },
    description: {
      sr: "Veličina logotipa u headeru (širina/visina u pikselima).",
      en: "Logo size in the header (width/height in pixels)."
    },
    min: 60,
    max: 320,
    step: 1,
    placeholder: "150"
  },
  {
    key: "PoweredByText",
    group: "Branding",
    type: "text",
    label: { sr: "Powered by tekst", en: "Powered by text" },
    description: {
      sr: "Tekst koji se prikazuje u footeru (npr. Powered by VLAH ENTERPRISE).",
      en: "Footer text shown on all pages (e.g. Powered by VLAH ENTERPRISE)."
    },
    placeholder: "Powered by VLAH ENTERPRISE"
  },
  {
    key: "PageMaxWidth",
    group: "Theme",
    type: "number",
    label: { sr: "Max širina stranice (px)", en: "Page max width (px)" },
    description: {
      sr: "Maksimalna širina sadržaja aplikacije.",
      en: "Maximum width of the app content."
    },
    min: 960,
    max: 1800,
    step: 10,
    placeholder: "1320"
  },

  // Theme
  {
    key: "MainColor",
    group: "Theme",
    type: "color",
    label: { sr: "Main color", en: "Main color" },
    description: { sr: "Primarna boja (accent).", en: "Primary accent color." },
    placeholder: "#000000"
  },
  {
    key: "SecondaryColor",
    group: "Theme",
    type: "color",
    label: { sr: "Secondary color", en: "Secondary color" },
    description: { sr: "Sekundarna boja (dugmad, highlight).", en: "Secondary accent (buttons, highlights)." },
    placeholder: "#F05123"
  },
  {
    key: "MainFontColor",
    group: "Theme",
    type: "color",
    label: { sr: "Main font color", en: "Main font color" },
    description: { sr: "Glavna boja teksta.", en: "Main text color." },
    placeholder: "#E4EEF0"
  },
  {
    key: "SecondaryFontColor",
    group: "Theme",
    type: "color",
    label: { sr: "Secondary font color", en: "Secondary font color" },
    description: { sr: "Sekundarna (muted) boja teksta.", en: "Secondary (muted) text color." },
    placeholder: "#A0A7A8"
  },
  {
    key: "Dark1",
    group: "Theme",
    type: "color",
    label: { sr: "Dark 1", en: "Dark 1" },
    description: { sr: "Pozadina (najtamija).", en: "Background (darkest)." },
    placeholder: "#050505"
  },
  {
    key: "Dark2",
    group: "Theme",
    type: "color",
    label: { sr: "Dark 2", en: "Dark 2" },
    description: { sr: "Paneli / kartice (tamna).", en: "Panels / cards (dark)." },
    placeholder: "#111111"
  },
  {
    key: "Light1",
    group: "Theme",
    type: "color",
    label: { sr: "Light 1", en: "Light 1" },
    description: { sr: "Svetla boja (koristi se za kontrast).", en: "Light color (used for contrast)." },
    placeholder: "#E4EEF0"
  },
  {
    key: "Light2",
    group: "Theme",
    type: "color",
    label: { sr: "Light 2", en: "Light 2" },
    description: { sr: "Svetla (border) boja.", en: "Light border color." },
    placeholder: "#C6CCCD"
  },
  {
    key: "AccentBlue",
    group: "Theme",
    type: "color",
    label: { sr: "Accent blue", en: "Accent blue" },
    description: {
      sr: "Dodatna accent boja za UI (npr. Absence modul, kalendar i grafikoni).",
      en: "Extra UI accent color (e.g. Absence module, calendar and charts)."
    },
    placeholder: "#5252FF"
  },
  {
    key: "AccentGold",
    group: "Theme",
    type: "color",
    label: { sr: "Accent gold", en: "Accent gold" },
    description: {
      sr: "Dodatna accent boja (npr. Performance modul i highlight elementi).",
      en: "Extra accent color (e.g. Performance module and highlights)."
    },
    placeholder: "#E9C46A"
  },
  {
    key: "AccentTeal",
    group: "Theme",
    type: "color",
    label: { sr: "Accent teal", en: "Accent teal" },
    description: {
      sr: "Dodatna accent boja koja se koristi u grafikonima (paleta).",
      en: "Extra accent color used in charts (palette)."
    },
    placeholder: "#264653"
  },
  {
    key: "AccentCyan",
    group: "Theme",
    type: "color",
    label: { sr: "Accent cyan", en: "Accent cyan" },
    description: {
      sr: "Dodatna accent boja koja se koristi u grafikonima (paleta).",
      en: "Extra accent color used in charts (palette)."
    },
    placeholder: "#8ECAE6"
  },
  {
    key: "AccentAmber",
    group: "Theme",
    type: "color",
    label: { sr: "Accent amber", en: "Accent amber" },
    description: {
      sr: "Dodatna accent boja koja se koristi u grafikonima (paleta).",
      en: "Extra accent color used in charts (palette)."
    },
    placeholder: "#FFB703"
  },
  {
    key: "DangerColor",
    group: "Theme",
    type: "color",
    label: { sr: "Danger color", en: "Danger color" },
    description: { sr: "Greške i destruktivne akcije.", en: "Errors and destructive actions." },
    placeholder: "#C62828"
  },
  {
    key: "OkColor",
    group: "Theme",
    type: "color",
    label: { sr: "OK color", en: "OK color" },
    description: { sr: "Uspeh i potvrde.", en: "Success and confirmations." },
    placeholder: "#1E8E6A"
  },

  // Daily reports
  {
    key: "MinDayActivtyDuration",
    group: "DailyReports",
    type: "number",
    label: { sr: "Min sati po danu", en: "Min hours/day" },
    description: { sr: "Minimalno ukupno sati koje user mora da unese u reportu.", en: "Minimum total hours a user must report for a day." },
    min: 0,
    max: 24,
    step: 0.25,
    placeholder: "1"
  },
  {
    key: "MaxDayActivtyDuration",
    group: "DailyReports",
    type: "number",
    label: { sr: "Max sati po danu", en: "Max hours/day" },
    description: { sr: "Maksimalno ukupno sati koje user može da unese u reportu.", en: "Maximum total hours a user can report for a day." },
    min: 0,
    max: 24,
    step: 0.25,
    placeholder: "20"
  },
  {
    key: "MaxActivitiesPerDay",
    group: "DailyReports",
    type: "number",
    label: { sr: "Max aktivnosti po danu", en: "Max activities/day" },
    description: { sr: "Maksimalan broj activity redova u jednom reportu.", en: "Maximum number of activity rows in one daily report." },
    min: 1,
    max: 200,
    step: 1,
    placeholder: "20"
  },

  // Tasks
  {
    key: "AllowAncestorApprovalTasks",
    group: "Tasks",
    type: "boolean",
    label: { sr: "Ancestor approval (Tasks)", en: "Ancestor approval (Tasks)" },
    description: {
      sr: "Ako je 1: ancestor manager može da odobri task kada je direktni manager na odobrenom odsustvu.",
      en: "If 1: an ancestor manager can approve a task when the direct manager is on approved leave."
    },
    placeholder: "1"
  },
  {
    key: "EmailFooterTask",
    group: "Tasks",
    type: "text",
    label: { sr: "Email footer (Tasks)", en: "Email footer (Tasks)" },
    description: { sr: "Footer teksta u email notifikacijama za zadatke (kada dodamo email).", en: "Footer for task emails (once email is enabled)." }
  },

  // Absence
  {
    key: "AnnualLeaveDays",
    group: "Absence",
    type: "number",
    label: { sr: "Godišnji odmor (limit)", en: "Annual leave (limit)" },
    description: { sr: "Default broj dana godišnjeg odmora po zaposlenom.", en: "Default annual leave days per employee." },
    min: 0,
    max: 365,
    step: 1,
    placeholder: "23"
  },
  {
    key: "HomeOfficeLimit",
    group: "Absence",
    type: "number",
    label: { sr: "Home office (limit)", en: "Home office (limit)" },
    description: { sr: "Default limit dana Home Office-a po godini.", en: "Default Home Office days limit per year." },
    min: 0,
    max: 365,
    step: 1,
    placeholder: "40"
  },
  {
    key: "AllowAncestorApprovalAbsence",
    group: "Absence",
    type: "boolean",
    label: { sr: "Ancestor approval (Absence)", en: "Ancestor approval (Absence)" },
    description: {
      sr: "Ako je 1: ancestor manager može da odobri odsustvo kada je direktni manager na odsustvu.",
      en: "If 1: an ancestor manager can approve absence when the direct manager is on leave."
    },
    placeholder: "1"
  },
  {
    key: "EmailFooterLeave",
    group: "Absence",
    type: "text",
    label: { sr: "Email footer (Absence)", en: "Email footer (Absence)" },
    description: { sr: "Footer teksta u email notifikacijama za odsustva (kada dodamo email).", en: "Footer for absence emails (once email is enabled)." }
  },

  // Performance (keys exist in sheet; module will use them)
  {
    key: "PerformancePeriodMonths",
    group: "Performance",
    type: "number",
    label: { sr: "Performance period (meseci)", en: "Performance period (months)" },
    description: { sr: "Dužina perioda evaluacije u mesecima.", en: "Evaluation period length in months." },
    min: 1,
    max: 24,
    step: 1,
    placeholder: "3"
  },
  {
    key: "PerformanceSelfReviewStartDays",
    group: "Performance",
    type: "number",
    label: { sr: "Self-review start (dana pre kraja)", en: "Self-review start (days before end)" },
    description: {
      sr: "Koliko dana pre kraja perioda otvara self-review (employee deo).",
      en: "How many days before period end self-review opens (employee part)."
    },
    min: 0,
    max: 180,
    step: 1,
    placeholder: "20"
  },
  {
    key: "PerformanceSelfReviewDeadlineDays",
    group: "Performance",
    type: "number",
    label: { sr: "Self-review deadline (dana pre kraja)", en: "Self-review deadline (days before end)" },
    description: {
      sr: "Koliko dana pre kraja perioda je deadline za self-review submit.",
      en: "How many days before period end is the self-review submission deadline."
    },
    min: 0,
    max: 180,
    step: 1,
    placeholder: "10"
  },
  {
    key: "PerformanceReminderDay",
    group: "Performance",
    type: "text",
    label: { sr: "Reminder dan (MON..SUN)", en: "Reminder day (MON..SUN)" },
    description: { sr: "Dan u nedelji za reminder job (kada dodamo scheduler).", en: "Weekday for reminder job (once scheduler is enabled)." },
    placeholder: "MON"
  },
  {
    key: "PerformanceReminderHour",
    group: "Performance",
    type: "number",
    label: { sr: "Reminder sat", en: "Reminder hour" },
    description: { sr: "Sat (0–23) za reminder job.", en: "Hour (0–23) for reminder job." },
    min: 0,
    max: 23,
    step: 1,
    placeholder: "9"
  },
  {
    key: "PerformanceReminderMinute",
    group: "Performance",
    type: "number",
    label: { sr: "Reminder minut", en: "Reminder minute" },
    description: { sr: "Minut (0–59) za reminder job.", en: "Minute (0–59) for reminder job." },
    min: 0,
    max: 59,
    step: 1,
    placeholder: "0"
  },
  {
    key: "PerformancePersonalWeight",
    group: "Performance",
    type: "number",
    label: { sr: "Personal weight (%)", en: "Personal weight (%)" },
    description: { sr: "Težina personal score-a u final score-u.", en: "Weight of personal score in final score." },
    min: 0,
    max: 100,
    step: 1,
    placeholder: "30"
  },
  {
    key: "PerformanceGoalsWeight",
    group: "Performance",
    type: "number",
    label: { sr: "Goals weight (%)", en: "Goals weight (%)" },
    description: { sr: "Težina goals score-a u final score-u.", en: "Weight of goals score in final score." },
    min: 0,
    max: 100,
    step: 1,
    placeholder: "70"
  },
  {
    key: "PerformanceManagerLockDays",
    group: "Performance",
    type: "number",
    label: { sr: "Manager lock (dana pre kraja)", en: "Manager lock (days before end)" },
    description: {
      sr: "Legacy setting (Apps Script): koliko dana pre kraja perioda menadžer prestaje da menja review (koristi se za reminder logiku).",
      en: "Legacy setting (Apps Script): how many days before period end the manager stops editing (used for reminder logic)."
    },
    min: 0,
    max: 180,
    step: 1,
    placeholder: "5"
  },
  {
    key: "PerformanceFinalConfirmDays",
    group: "Performance",
    type: "number",
    label: { sr: "Final confirm (dana pre kraja)", en: "Final confirm (days before end)" },
    description: {
      sr: "Legacy setting (Apps Script): window za finalizaciju/close (koristi se za reminder logiku).",
      en: "Legacy setting (Apps Script): finalization/close window (used for reminder logic)."
    },
    min: 0,
    max: 180,
    step: 1,
    placeholder: "5"
  },
  {
    key: "PerformanceCriticalDays",
    group: "Performance",
    type: "number",
    label: { sr: "Critical (dana pre deadline)", en: "Critical (days before deadline)" },
    description: {
      sr: "Koliko dana pre self-review deadline evaluacija dobija oznaku \"Critical\" (za menadžera).",
      en: "How many days before the self-review deadline an evaluation becomes \"Critical\" (manager view)."
    },
    min: 1,
    max: 30,
    step: 1,
    placeholder: "3"
  },
  {
    key: "PerformanceAllowCloseBeforePeriodEnd",
    group: "Performance",
    type: "boolean",
    label: { sr: "Dozvoli zatvaranje pre kraja", en: "Allow closing before end" },
    description: {
      sr: "Ako je 1: admin/manager može da zatvori evaluaciju pre PeriodEnd.",
      en: "If 1: admin/manager can close an evaluation before PeriodEnd."
    },
    placeholder: "0"
  },

  // Backup (also available in dedicated Backup page)
  {
    key: "BackupEnabled",
    group: "Backup",
    type: "boolean",
    label: { sr: "Backup enabled", en: "Backup enabled" },
    description: { sr: "Omogućava automatski backup dok aplikacija radi.", en: "Enables automatic backups while the app is running." },
    placeholder: "0"
  },
  {
    key: "BackupTime",
    group: "Backup",
    type: "time",
    label: { sr: "Backup vreme", en: "Backup time" },
    description: { sr: "Dnevno vreme (HH:MM) kada scheduler pokušava da uradi backup.", en: "Daily time (HH:MM) when scheduler runs backup." },
    placeholder: "02:00"
  },
  {
    key: "BackupKeepDays",
    group: "Backup",
    type: "number",
    label: { sr: "Backup keep days", en: "Backup keep days" },
    description: { sr: "Koliko dana zadržavamo backup fajlove na serveru.", en: "How many days backups are kept on the server." },
    min: 1,
    max: 3650,
    step: 1,
    placeholder: "30"
  },
  {
    key: "BackupFolder",
    group: "Backup",
    type: "text",
    label: { sr: "Backup folder", en: "Backup folder" },
    description: { sr: "Folder (relativno od root-a) gde se čuvaju backup ZIP fajlovi.", en: "Folder (relative to app root) where backup ZIP files are stored." },
    placeholder: "backups"
  }
];

export function groupLabel(lang: Lang, group: SettingGroup) {
  const labels: Record<SettingGroup, Record<Lang, string>> = {
    Branding: { sr: "Branding", en: "Branding" },
    Theme: { sr: "Tema (boje)", en: "Theme (colors)" },
    DailyReports: { sr: "Dnevni izveštaji", en: "Daily reports" },
    Tasks: { sr: "Zadaci", en: "Tasks" },
    Absence: { sr: "Odsustva", en: "Absence" },
    Performance: { sr: "Performanse", en: "Performance" },
    Backup: { sr: "Backup", en: "Backup" },
    Advanced: { sr: "Napredno", en: "Advanced" }
  };
  return labels[group][lang];
}

export function isValidHexColor(value: string) {
  const v = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) || /^#[0-9a-fA-F]{3}$/.test(v);
}
