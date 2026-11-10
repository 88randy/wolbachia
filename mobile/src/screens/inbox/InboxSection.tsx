import type { ReactNode } from "react";
import { View } from "react-native";
import { SectionTitle } from "../../ui/SectionTitle.tsx";

/** A titled block of the inbox ("Con problema", "En el teléfono · 12", ...). */
export function InboxSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <View className="gap-3">
      <SectionTitle title={title} />
      {children}
    </View>
  );
}
