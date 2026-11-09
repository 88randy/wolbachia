import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { FuelAdvisory } from "./FuelAdvisory.tsx";
import { FuelForm } from "./FuelForm.tsx";
import { FuelReceipt } from "./FuelReceipt.tsx";
import { FuelStatus } from "./FuelStatus.tsx";
import type { M11Model } from "./use-m-11.ts";
import { createFuelStyles } from "./styles.ts";
import { FuelEmpty } from "./FuelEmpty.tsx";
import { FuelLoading } from "./FuelLoading.tsx";

export function FuelBody({ model }: { readonly model: M11Model }) {
  const t = useT();
  const styles = useStyles(createFuelStyles);
  if (!model.state) return <FuelLoading />;
  const { ready, draft, event, advisory } = model.state;
  return (
    <View style={styles.group}>
      {!ready ? <Notice tone="warning" icon="lock" message={t("mobile.fuel.unavailable")} /> : null}
      {draft ? (
        <>
          <FuelStatus state={model.state} />
          {event ? null : (
            <AppText variant="caption">
              {t(model.hasPending ? "mobile.fuel.draftPending" : "mobile.fuel.draftSaved")}
            </AppText>
          )}
          <FuelForm model={model} />
          <FuelAdvisory advisory={advisory} />
          <FuelReceipt model={model} />
        </>
      ) : (
        <FuelEmpty model={model} />
      )}
    </View>
  );
}
