import { darkTheme, lightTheme } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

export type ColorScheme = "light" | "dark";

interface ThemeContextValue {
  readonly theme: Theme;
  readonly scheme: ColorScheme;
  readonly textScale: number;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  scheme: "light",
  textScale: 1,
});

interface ThemeProviderProps {
  /** Resolved appearance: live system scheme unless Settings has an explicit choice. */
  readonly scheme: ColorScheme;
  readonly children: ReactNode;
  readonly textScale?: number;
}

export function ThemeProvider({ scheme, children, textScale = 1 }: ThemeProviderProps) {
  const value = useMemo(
    () => ({ theme: scheme === "dark" ? darkTheme : lightTheme, scheme, textScale }),
    [scheme, textScale],
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
