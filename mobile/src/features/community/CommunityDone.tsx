import { ArrowLeft, Plus } from "lucide-react-native";
import { CircleCheck } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { EmptyState } from "../../ui/EmptyState.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";

/** The activity was received: say so, then offer to go back or register another one. */
export function CommunityDone({ onAnother }: { readonly onAnother: () => void }) {
  const t = useT();
  const { popToRoot } = useNavigation();
  return (
    <ScreenScaffold
      header={<AppHeader title={t("courier.flow.community.title")} onBack={null} />}
      footer={
        <>
          <PrimaryButton
            icon={ArrowLeft}
            label={t("courier.flow.community.back")}
            onPress={popToRoot}
          />
          <SecondaryButton
            icon={Plus}
            label={t("courier.flow.community.another")}
            onPress={onAnother}
          />
        </>
      }
    >
      <EmptyState
        icon={CircleCheck}
        title={t("courier.flow.community.doneTitle")}
        message={t("courier.flow.community.doneBody")}
      />
    </ScreenScaffold>
  );
}
