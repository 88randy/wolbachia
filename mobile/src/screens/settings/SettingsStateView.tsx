import { spacing } from "@wolbachia/tokens";
import { StyleSheet, View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Button } from "../../ui/Button.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";
import type { SettingsState } from "./settings-service.ts";
import { UpdateSupportCard } from "./UpdateSupportCard.tsx";
import { PendingWorkCard } from "./PendingWorkCard.tsx";

const styles = StyleSheet.create({ section: { gap: spacing[1.5] } });
interface Props {
  readonly state: SettingsState | null;
  readonly hasError: boolean;
  readonly onLock: () => void;
  readonly onInbox: () => void;
  readonly onRetry: () => void;
}
export function SettingsStateView({ state, hasError, onLock, onInbox, onRetry }: Props) {
  const t = useT();
  return (
    <View style={styles.section}>
      {hasError ? (
        <Notice tone="warning" icon="alert" message={t("mobile.settings.readFailed")} />
      ) : null}
      {state === null ? (
        <Skeleton />
      ) : (
        <>
          <UpdateSupportCard state={state} />
          <PendingWorkCard state={state} onInbox={onInbox} />
        </>
      )}
      <Button variant="outline" label={t("common.actions.retry")} onPress={onRetry} />
      <Button label={t("mobile.settings.lockAccess")} onPress={onLock} />
    </View>
  );
}
