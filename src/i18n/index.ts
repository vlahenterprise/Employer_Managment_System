export type { Lang } from "./common";
export { DEFAULT_LANG, LANG_COOKIE, normalizeLang } from "./common";

import { commonI18n } from "./common";
import { tasksI18n } from "./tasks";
import { absenceI18n } from "./absence";
import { performanceI18n } from "./performance";
import { reportsI18n } from "./reports";
import { adminI18n } from "./admin";
import { DEFAULT_LANG as FALLBACK_LANG, type Lang } from "./catalog";

export const I18N = {
  sr: {
    ...commonI18n.sr,
    ...reportsI18n.sr,
    ...tasksI18n.sr,
    ...absenceI18n.sr,
    ...performanceI18n.sr,
    ...adminI18n.sr
  },
  en: {
    ...commonI18n.en,
    ...reportsI18n.en,
    ...tasksI18n.en,
    ...absenceI18n.en,
    ...performanceI18n.en,
    ...adminI18n.en
  }
} as const;

export function getI18n(lang: Lang) {
  return I18N[lang ?? FALLBACK_LANG];
}

export * from "./common";
export * from "./tasks";
export * from "./absence";
export * from "./performance";
export * from "./reports";
export * from "./admin";
