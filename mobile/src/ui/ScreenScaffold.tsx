import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppScrollView } from "./AppScrollView.tsx";
import { BottomTabBar } from "./BottomTabBar.tsx";
import type { BottomTab } from "./BottomTabBar.tsx";

export interface ScreenScaffoldProps {
  /** Usually an AppHeader. */
  readonly header: ReactNode;
  readonly children: ReactNode;
  /** Sticky bottom area for the ONE primary action of the screen. */
  readonly footer?: ReactNode;
  /** Shows Mi día / Mapa / Ayuda (top-level screens only, never inside a wizard). */
  readonly tab?: BottomTab;
  /** Maps and other full-screen content must not scroll (see README). */
  readonly isScrollable?: boolean;
}

const FOOTER_BOTTOM_GAP = 12;

function Footer({
  children,
  padsGestureBar,
}: {
  readonly children: ReactNode;
  readonly padsGestureBar: boolean;
}) {
  const insets = useSafeAreaInsets();
  const paddingBottom = (padsGestureBar ? insets.bottom : 0) + FOOTER_BOTTOM_GAP;
  return (
    <View className="gap-3 border-t border-line bg-surface px-4 pt-3" style={{ paddingBottom }}>
      {children}
    </View>
  );
}

/** Page template of every courier screen: header, scrolling body, sticky action, optional tabs. */
export function ScreenScaffold({
  header,
  children,
  footer,
  tab,
  isScrollable = true,
}: ScreenScaffoldProps) {
  return (
    <View className="flex-1 bg-bg">
      {header}
      {isScrollable ? (
        <AppScrollView
          className="flex-1"
          contentContainerClassName="gap-4 p-4 pb-8"
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </AppScrollView>
      ) : (
        <View className="flex-1">{children}</View>
      )}
      {footer ? <Footer padsGestureBar={tab === undefined}>{footer}</Footer> : null}
      {tab ? <BottomTabBar active={tab} /> : null}
    </View>
  );
}
