"use client";

import { Lang, LANG_COOKIE, normalizeLang } from "@/i18n";

function setLangCookie(lang: Lang) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=${maxAge}; samesite=lax`;
}

export default function LangToggle({ lang }: { lang: Lang }) {
  const current = normalizeLang(lang);

  function switchTo(next: Lang) {
    if (next === current) return;
    setLangCookie(next);
    window.location.reload();
  }

  return (
    <div className="lang-toggle" role="group" aria-label="Language switch">
      <button
        className={current === "sr" ? "button" : "button button-secondary"}
        type="button"
        onClick={() => switchTo("sr")}
      >
        SR
      </button>
      <button
        className={current === "en" ? "button" : "button button-secondary"}
        type="button"
        onClick={() => switchTo("en")}
      >
        EN
      </button>
    </div>
  );
}

