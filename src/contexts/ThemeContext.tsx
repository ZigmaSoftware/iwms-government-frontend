import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type Theme = "light" | "dark";

type ThemePalette = {
  primary: string;
  primaryHover: string;
  primarySoft: string;
  primaryGradient: string;
  accent: string;
  accentHover: string;
  accentSoft: string;
  surface: string;
  surfaceMuted: string;
  surfaceAlt: string;
  border: string;
  text: string;
  mutedText: string;
  cardShadow: string;
};

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  palette: ThemePalette;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_PALETTES: Record<Theme, ThemePalette> = {
  light: {
    primary: "#013E7E",
    primaryHover: "#0a4f99",
    primarySoft: "#e3ecf8",
    primaryGradient: "#013E7E",
    accent: "#0a4f99",
    accentHover: "#1166c1",
    accentSoft: "#deebff",
    surface: "#f2f6fb",
    surfaceMuted: "#e7edf6",
    surfaceAlt: "#ffffff",
    border: "#d6e6ff",
    text: "#071731",
    mutedText: "#55637b",
    cardShadow: "0 15px 40px rgba(1, 62, 126, 0.18)",
  },
  dark: {
    primary: "#2f63a8",
    primaryHover: "#3e7ac7",
    primarySoft: "rgba(1, 62, 126, 0.25)",
    primaryGradient: "#013E7E",
    accent: "#3e7ac7",
    accentHover: "#5291e6",
    accentSoft: "rgba(1, 62, 126, 0.35)",
    surface: "#050b15",
    surfaceMuted: "#0d1624",
    surfaceAlt: "#0f1c31",
    border: "#1f3554",
    text: "#f3f8ff",
    mutedText: "#97b3d6",
    cardShadow: "0 25px 45px rgba(2, 8, 20, 0.85)",
  },
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("iwms-theme");
    return (saved as Theme) || "light";
  });

  const palette = useMemo(() => THEME_PALETTES[theme], [theme]);

  useEffect(() => {
    localStorage.setItem("iwms-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    Object.entries(palette).forEach(([token, value]) => {
      root.style.setProperty(`--admin-${token}`, value);
    });
  }, [palette]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, palette }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
