"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const themeStorageKey = "ai-interview-simulator-theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(themeStorageKey);
    const nextTheme: Theme = savedTheme === "dark" ? "dark" : "light";

    setTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    setMounted(true);
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    window.localStorage.setItem(themeStorageKey, nextTheme);
  }

  const nextThemeLabel = theme === "light" ? "Dark" : "Light";
  const nextThemeIcon = theme === "light" ? "🌙" : "☀️";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
      aria-label={`Switch to ${nextThemeLabel} Mode`}
      aria-pressed={mounted && theme === "dark"}
    >
      {mounted ? nextThemeIcon : "🌙"}
    </button>
  );
}
