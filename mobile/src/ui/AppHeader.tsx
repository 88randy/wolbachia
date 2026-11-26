import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useNavigation } from "../navigation/NavigationProvider.tsx";
import { BackButton } from "./BackButton.tsx";
import { HeaderTitle } from "./HeaderTitle.tsx";
import { StepProgress } from "./StepProgress.tsx";
import { SyncChip } from "./SyncChip.tsx";

export interface AppHeaderProps {
  readonly title: string;
  /** Small line above the title (for example the app name or the point code). */
  readonly subtitle?: string;
  /** Wizard position: shows "Paso X de N" and the progress bar. */
  readonly step?: { readonly current: number; readonly total: number };
  /**
   * Back action. Defaults to the navigation stack when there is a screen to go back to; pass
   * `null` to hide the button (home, top-level tabs).
   */
  readonly onBack?: (() => void) | null;
  /** Hide the sync chip only where sending is already explained (inbox, login). */
  readonly showSync?: boolean;
  /** Extra trailing control, for example a settings icon. */
  readonly trailing?: ReactNode;
  /** Set false when a parent SafeAreaView already pads the status bar (auth overlay). */
  readonly padsStatusBar?: boolean;
}

const HEADER_TOP_GAP = 8;

/** Screen header of the prototype: back, title, "Paso X de N" with progress, and the sync chip. */
export function AppHeader(props: AppHeaderProps) {
  const { step, onBack, showSync = true, trailing, padsStatusBar = true } = props;
  const insets = useSafeAreaInsets();
  const { canGoBack, goBack } = useNavigation();
  const back = onBack === undefined ? (canGoBack ? goBack : null) : onBack;
  const paddingTop = (padsStatusBar ? insets.top : 0) + HEADER_TOP_GAP;
  return (
    <View className="gap-3 border-b border-line bg-surface px-4 pb-3" style={{ paddingTop }}>
      <View className="min-h-12 flex-row items-center gap-2">
        {back ? <BackButton onPress={back} /> : null}
        <HeaderTitle title={props.title} subtitle={props.subtitle} step={step} />
        {trailing}
        {showSync ? <SyncChip /> : null}
      </View>
      {step ? <StepProgress current={step.current} total={step.total} /> : null}
    </View>
  );
}
