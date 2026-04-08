"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle({ lang }: { lang: "sr" | "en" }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("ems-theme");
    const current = document.documentElement.getAttribute("data-theme");
    setTheme((saved || current || "dark") as "dark" | "light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("ems-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      title={theme === "dark" ? (lang === "sr" ? "Svetla tema" : "Light theme") : (lang === "sr" ? "Tamna tema" : "Dark theme")}
      aria-label={theme === "dark" ? (lang === "sr" ? "Prebaci na svetlu temu" : "Switch to light theme") : (lang === "sr" ? "Prebaci na tamnu temu" : "Switch to dark theme")}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
