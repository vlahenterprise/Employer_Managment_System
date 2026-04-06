export type { Lang } from "./catalog";
export { DEFAULT_LANG, LANG_COOKIE, normalizeLang } from "./catalog";

import { I18N } from "./catalog";

export const commonI18n = {
  sr: {
    languages: I18N.sr.languages,
    common: I18N.sr.common,
    login: I18N.sr.login,
    dashboard: I18N.sr.dashboard,
    org: I18N.sr.org,
    modules: I18N.sr.modules
  },
  en: {
    languages: I18N.en.languages,
    common: I18N.en.common,
    login: I18N.en.login,
    dashboard: I18N.en.dashboard,
    org: I18N.en.org,
    modules: I18N.en.modules
  }
} as const;
