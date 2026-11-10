import { AppScrollView } from "../../ui/AppScrollView.tsx";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { ScreenHeader } from "../../ui/ScreenHeader.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { createShiftStyles } from "../shift-open/styles.ts";
import { LifecycleControls } from "./LifecycleControls.tsx";
import { LifecycleBody } from "./LifecycleBody.tsx";
import { LifecycleFooter } from "./LifecycleFooter.tsx";
import { KIND_LABEL } from "./labels.ts";
import { useM09 } from "./use-m-09.ts";
import type { StartInput } from "./new-draft.ts";
export function LifecycleScreen(input: StartInput) {
  const model = useM09();
  const t = useT();
  const styles = useStyles(createShiftStyles);
  const draft = model.state?.draft;
  return (
    <View style={styles.root}>
      <ScreenHeader
        largeTargets
        title={t(KIND_LABEL[draft?.kind ?? input.kind])}
        subtitle={draft?.point.code}
      />
      <AppScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {model.errorKey ? (
          <Notice tone="critical" icon="alert" message={t(model.errorKey)} />
        ) : null}
        <LifecycleControls model={model} input={input} />
        <LifecycleBody model={model} />
      </AppScrollView>
      {draft && !model.state?.event ? (
        <LifecycleFooter key={draft.eventId} model={model} draft={draft} />
      ) : null}
    </View>
  );
}
