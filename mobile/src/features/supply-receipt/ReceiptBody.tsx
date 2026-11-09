import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { ReceiptSources } from "./ReceiptSources.tsx";
import { ReceiptForm } from "./ReceiptForm.tsx";
import { createReceiptStyles } from "./styles.ts";
import type { M05Model } from "./use-m-05.ts";

export function ReceiptBody({ model }: { readonly model: M05Model }) {
  const t = useT();
  const styles = useStyles(createReceiptStyles);
  if (!model.state)
    return <View style={styles.skeleton} accessibilityLabel={t("mobile.supplyReceipt.title")} />;
  const { ready, assignments, draft } = model.state;
  return (
    <View style={styles.group}>
      {!ready ? (
        <Notice tone="warning" icon="lock" message={t("mobile.supplyReceipt.unavailable")} />
      ) : null}
      {ready && !assignments.some((assignment) => assignment.releases.length) ? (
        <Notice tone="info" icon="list" message={t("mobile.supplyReceipt.noAssignments")} />
      ) : null}
      <ReceiptSources model={model} />
      {draft ? <ReceiptForm model={model} /> : null}
    </View>
  );
}
