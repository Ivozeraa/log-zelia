import { FaMoon, FaSun } from "react-icons/fa";
import { useTheme } from "../../hooks/useTheme";

export function PublicThemeToggle({ compact = false }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
      aria-pressed={isDark}
      title={isDark ? "Modo claro" : "Modo escuro"}
      className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-green-300 hover:text-green-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-green-700"
    >
      {isDark ? <FaSun aria-hidden="true" /> : <FaMoon aria-hidden="true" />}
      {!compact && <span className="hidden sm:inline">{isDark ? "Claro" : "Escuro"}</span>}
    </button>
  );
}
