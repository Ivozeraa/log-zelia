import { useEffect, useState } from "react";
import { applyTheme } from "../theme";

const getStoredTheme = () => {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem("theme") === "dark" ? "dark" : "light";
};

export function useTheme() {
  const [theme, setTheme] = useState(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("theme", theme);
    window.dispatchEvent(new CustomEvent("logview-theme-change", { detail: theme }));
  }, [theme]);

  useEffect(() => {
    const syncTheme = () => setTheme(getStoredTheme());

    window.addEventListener("storage", syncTheme);
    window.addEventListener("logview-theme-change", syncTheme);

    return () => {
      window.removeEventListener("storage", syncTheme);
      window.removeEventListener("logview-theme-change", syncTheme);
    };
  }, []);

  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  return { theme, toggleTheme };
}
