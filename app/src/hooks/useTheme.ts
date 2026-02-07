// DEAD CODE — All consumers import useTheme from @/components/ThemeProvider, not this file.
// Commented out 2026-02-06. Safe to delete if still unused after next review.

// "use client";
//
// import { useState, useEffect, useCallback } from "react";
//
// type Theme = "light" | "dark" | "auto";
//
// export function useTheme() {
//   const [theme, setThemeState] = useState<Theme>("auto");
//   const [isDark, setIsDark] = useState(true);
//
//   // Initialize theme from localStorage or system preference
//   useEffect(() => {
//     const stored = localStorage.getItem("theme") as Theme | null;
//     if (stored) {
//       setThemeState(stored);
//       applyTheme(stored);
//     } else {
//       applyTheme("auto");
//     }
//   }, []);
//
//   // Listen for system theme changes
//   useEffect(() => {
//     const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
//     const handleChange = () => {
//       if (theme === "auto") {
//         setIsDark(mediaQuery.matches);
//       }
//     };
//
//     mediaQuery.addEventListener("change", handleChange);
//     return () => mediaQuery.removeEventListener("change", handleChange);
//   }, [theme]);
//
//   const applyTheme = useCallback((newTheme: Theme) => {
//     const root = document.documentElement;
//     const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
//
//     if (newTheme === "dark" || (newTheme === "auto" && prefersDark)) {
//       root.removeAttribute("data-theme");
//       setIsDark(true);
//     } else {
//       root.setAttribute("data-theme", "light");
//       setIsDark(false);
//     }
//   }, []);
//
//   const setTheme = useCallback(
//     (newTheme: Theme) => {
//       setThemeState(newTheme);
//       localStorage.setItem("theme", newTheme);
//       applyTheme(newTheme);
//     },
//     [applyTheme]
//   );
//
//   const toggleTheme = useCallback(() => {
//     const newTheme = isDark ? "light" : "dark";
//     setTheme(newTheme);
//   }, [isDark, setTheme]);
//
//   return {
//     theme,
//     isDark,
//     setTheme,
//     toggleTheme,
//   };
// }
