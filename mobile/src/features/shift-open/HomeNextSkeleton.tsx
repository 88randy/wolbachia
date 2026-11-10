import { View } from "react-native";

import { Skeleton } from "../../ui/Skeleton.tsx";

/** Same footprint as the "Lo que sigue" card, so the real card replaces it without a jump. */
export function HomeNextSkeleton() {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      className="min-h-56 gap-4 rounded-card bg-surface p-5"
    >
      <Skeleton isShort />
      <Skeleton />
      <Skeleton isShort />
    </View>
  );
}
