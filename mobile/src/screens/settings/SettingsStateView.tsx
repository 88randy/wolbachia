import { Lock, RotateCw } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";
import { PendingWorkCard } from "./PendingWorkCard.tsx";
import type { SettingsState } from "./settings-service.ts";
import { UpdateSupportCard } from "./UpdateSupportCard.tsx";

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
    <>
      {hasError ? (
        <>
          <InfoNotice tone="warning" message={t("mobile.settings.readFailed")} />
          <SecondaryButton icon={RotateCw} label={t("common.actions.retry")} onPress={onRetry} />
        </>
      ) : null}
      {state === null ? (
        <Skeleton />
      ) : (
        <>
          <PendingWorkCard state={state} onInbox={onInbox} />
          <UpdateSupportCard state={state} />
        </>
      )}
      <PrimaryButton icon={Lock} label={t("mobile.settings.lockAccess")} onPress={onLock} />
    </>
  );
}
