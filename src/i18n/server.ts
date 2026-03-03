import "server-only";

import { cookies } from "next/headers";
import { DEFAULT_LANG, LANG_COOKIE, normalizeLang } from "./index";

export function getRequestLang() {
  const value = cookies().get(LANG_COOKIE)?.value;
  return normalizeLang(value ?? DEFAULT_LANG);
}

