import { View } from "react-native";

import { ActionTile } from "./ActionTile.tsx";
import type { ActionTileProps } from "./ActionTile.tsx";

export type ActionGridItem = ActionTileProps & { readonly key: string };

const PER_ROW = 2;

/** Tiles in rows of two (a lone last tile takes the full width). */
export function ActionGrid({ items }: { readonly items: readonly ActionGridItem[] }) {
  const rows: ActionGridItem[][] = [];
  items.forEach((item, index) => {
    if (index % PER_ROW === 0) rows.push([]);
    rows[rows.length - 1]?.push(item);
  });
  return (
    <View className="gap-3">
      {rows.map((row) => (
        <View key={row.map((item) => item.key).join("|")} className="flex-row gap-3">
          {row.map(({ key, ...tile }) => (
            <ActionTile key={key} {...tile} />
          ))}
        </View>
      ))}
    </View>
  );
}
