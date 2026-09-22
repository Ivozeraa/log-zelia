import { useEffect, useMemo, useState } from "react";
import { createTheme, ThemeProvider } from "@mui/material/styles";

const readDarkMode = () => document.documentElement.classList.contains("dark");

export function MuiTheme({ children }) {
  const [darkMode, setDarkMode] = useState(readDarkMode);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setDarkMode(readDarkMode()));
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? "dark" : "light",
          primary: { main: "#16a34a" },
          background: {
            default: darkMode ? "#030712" : "#f5f5f5",
            paper: darkMode ? "#0f172a" : "#ffffff",
          },
        },
        typography: {
          fontFamily: '"Inter", sans-serif',
        },
        shape: {
          borderRadius: 12,
        },
        components: {
          MuiButton: {
            defaultProps: { disableElevation: true },
            styleOverrides: {
              root: { textTransform: "none", fontWeight: 600 },
            },
          },
          MuiDialog: {
            styleOverrides: {
              paper: {
                border: darkMode ? "1px solid #334155" : "1px solid #e2e8f0",
                borderRadius: 16,
              },
            },
          },
          MuiChip: {
            styleOverrides: {
              root: { fontWeight: 600 },
            },
          },
        },
      }),
    [darkMode]
  );

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
