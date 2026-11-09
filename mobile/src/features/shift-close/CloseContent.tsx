import { AppScrollView } from "../../ui/AppScrollView.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { createShiftStyles } from "../shift-open/styles.ts";
import { CloseSkeleton } from "./CloseSkeleton.tsx";
import { P26Screen } from "./P26Screen.tsx";
import { P27Screen } from "./P27Screen.tsx";
import type { M14Model } from "./use-m-14.ts";

export function CloseContent({ model }: { readonly model: M14Model }) {
  const styles = useStyles(createShiftStyles);
  if (model.state === null) return <CloseSkeleton />;
  if (!model.state.draft?.locallyClosedAt) return <P26Screen model={model} />;
  return (
    <AppScrollView contentContainerStyle={styles.content}>
      <P27Screen state={model.state} />
    </AppScrollView>
  );
}
