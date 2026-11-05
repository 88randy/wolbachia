import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { Button } from "../../ui/Button.tsx";
import type { M06Model } from "./use-m-06.ts";

export function DayEmptyState({ model }: { readonly model: M06Model }) {
  const t = useT();
  const { goBack } = useNavigation();
  const isComplete = model.phase === "complete";
  if (model.phase !== "empty" && !isComplete) return null;
  return (
    <>
      <Notice
        tone="info"
        icon={isComplete ? "check" : "list"}
        message={t(isComplete ? "mobile.day.ready" : "mobile.day.empty")}
      />
      <Button
        label={t(isComplete ? "mobile.day.backHome" : "mobile.day.refresh")}
        disabled={!isComplete && model.isRefreshing}
        onPress={() => {
          if (isComplete) goBack();
          else void model.refresh();
        }}
      />
    </>
  );
}
