import { FlatList } from "react-native";
import type { FlatListProps } from "react-native";

import { useTheme } from "../theme/ThemeProvider.tsx";

/** Virtualized lists share the same native indicator policy as AppScrollView. */
export function AppFlatList<Item>(props: FlatListProps<Item>) {
  const { scheme } = useTheme();
  return (
    <FlatList
      {...props}
      showsVerticalScrollIndicator
      showsHorizontalScrollIndicator
      indicatorStyle={scheme === "dark" ? "white" : "black"}
    />
  );
}
