import { darkTheme, lightTheme } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

export type ColorScheme = "light" | "dark";

interface ThemeContextValue {
  readonly theme: Theme;
  readonly scheme: ColorScheme;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: lightTheme, scheme: "light" });

interface ThemeProviderProps {
  /** Light is the default; dark is a person's choice in Settings. */
  readonly scheme: ColorScheme;
  readonly children: ReactNode;
}

export function ThemeProvider({ scheme, children }: ThemeProviderProps) {
  const value = useMemo(
    () => ({ theme: scheme === "dark" ? darkTheme : lightTheme, scheme }),
    [scheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * Builds a component's `StyleSheet` from the current theme. Pass a module-level factory
 * (`const createStyles = (theme: Theme) => StyleSheet.create({ ... })`); it runs again only when
 * the theme changes.
 */
export function useStyles<Styles>(factory: (theme: Theme) => Styles): Styles {
  const { theme } = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}
