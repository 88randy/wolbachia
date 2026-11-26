import { useMemo } from "react";
import type { ReactNode } from "react";
import { View } from "react-native";

import { useTheme } from "../theme/ThemeProvider.tsx";
import { themeVars } from "./theme-vars.ts";

/** Root view that publishes the token CSS variables used by every kit `className`. */
export function ThemeVarsRoot({ children }: { readonly children: ReactNode }) {
  const { theme } = useTheme();
  const style = useMemo(() => themeVars(theme), [theme]);
  return (
    <View className="flex-1 bg-bg" style={style}>
      {children}
    </View>
  );
}
