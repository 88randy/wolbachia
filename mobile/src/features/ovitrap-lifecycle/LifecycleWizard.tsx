import { ArrowRight, Save } from "lucide-react-native";
import { useState } from "react";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { LifecycleConfirmPage } from "./LifecycleConfirmPage.tsx";
import { LifecyclePhotoPage } from "./LifecyclePhotoPage.tsx";
import { LifecycleReasonPage } from "./LifecycleReasonPage.tsx";
import { LifecycleRecoveryPage } from "./LifecycleRecoveryPage.tsx";
import { RemoveSheet } from "./RemoveSheet.tsx";
import { needsOther } from "./domain.ts";
import type { LifecycleProps } from "./model.ts";
import type { LifecycleDraft, LifecycleKind } from "./types.ts";
import { useLifecycleSave } from "./use-lifecycle-save.ts";

type Page = "recovery" | "reason" | "photo" | "confirm";

const PAGES: Readonly<Record<LifecycleKind, readonly Page[]>> = {
  replace: ["reason", "photo", "confirm"],
  relocate: ["reason", "photo", "confirm"],
  remove: ["recovery", "reason", "photo", "confirm"],
};

function isPageDone(page: Page, draft: LifecycleDraft): boolean {
  if (page === "recovery") return draft.recovery !== null;
  if (page === "reason")
    return draft.reasonCode !== "" && (!needsOther(draft) || draft.otherText.trim() !== "");
  if (page === "photo") return draft.evidence.length > 0;
  return true;
}

function PageBody({ page, ...props }: LifecycleProps & { readonly page: Page }) {
  if (page === "recovery") return <LifecycleRecoveryPage {...props} />;
  if (page === "reason") return <LifecycleReasonPage {...props} />;
  if (page === "photo") return <LifecyclePhotoPage {...props} />;
  return <LifecycleConfirmPage {...props} />;
}

/** Replace, move or retire a trap, one question per page, "Paso X de N", one button at the bottom. */
export function LifecycleWizard(props: LifecycleProps) {
  const { model, draft } = props;
  const t = useT();
  const pages = PAGES[draft.kind];
  const [index, setIndex] = useState(0);
  const page = pages[index] ?? "confirm";
  const save = useLifecycleSave(props);
  const isLast = index === pages.length - 1;
  const isDanger = draft.kind === "remove";
  return (
    <ScreenScaffold
      header={
        <AppHeader
          title={t(`field.lifecycle.kind.${draft.kind}`)}
          subtitle={t("field.lifecycle.confirmPoint", { code: draft.point.code })}
          step={{ current: index + 1, total: pages.length }}
          onBack={
            index === 0
              ? undefined
              : () => {
                  setIndex(index - 1);
                }
          }
        />
      }
      footer={
        isLast ? (
          <PrimaryButton
            tone={isDanger ? "danger" : "default"}
            icon={Save}
            label={t(`field.lifecycle.save.${draft.kind}`)}
            isLoading={model.isBusy}
            disabled={model.isBusy || save.isBlocked}
            onPress={save.submit}
          />
        ) : (
          <PrimaryButton
            icon={ArrowRight}
            label={t("field.action.next")}
            disabled={model.isBusy || !isPageDone(page, draft)}
            onPress={() => {
              setIndex(index + 1);
            }}
          />
        )
      }
    >
      {model.errorKey ? <InfoNotice tone="danger" message={t("field.lifecycle.problem")} /> : null}
      <PageBody page={page} {...props} />
      <RemoveSheet
        isOpen={save.isOpen}
        close={save.close}
        save={save.save}
        isBusy={model.isBusy}
        draft={draft}
      />
    </ScreenScaffold>
  );
}
