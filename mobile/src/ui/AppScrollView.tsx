import { ScrollView } from "react-native";
import type { ScrollViewProps } from "react-native";

import { useTheme } from "../theme/ThemeProvider.tsx";

/** Native thin indicators, consistently visible while scrolling in both directions. */
export function AppScrollView(props: ScrollViewProps) {
  const { scheme } = useTheme();
  return (
    <ScrollView
      {...props}
      showsVerticalScrollIndicator
      showsHorizontalScrollIndicator
      indicatorStyle={scheme === "dark" ? "white" : "black"}
    />
  );
}
