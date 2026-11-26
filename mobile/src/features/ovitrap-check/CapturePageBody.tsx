import { useT } from "../../i18n/I18nProvider.tsx";
import { BagPage } from "./BagPage.tsx";
import { ConditionsPage } from "./ConditionsPage.tsx";
import { ConfirmPage } from "./ConfirmPage.tsx";
import { FindingPage } from "./FindingPage.tsx";
import { LabelPage } from "./LabelPage.tsx";
import { PhotoPage } from "./PhotoPage.tsx";
import { PointPage } from "./PointPage.tsx";
import { PreparePage } from "./PreparePage.tsx";
import { YesNoPage } from "./YesNoPage.tsx";
import type { CapturePage } from "./capture-pages.ts";
import { choose } from "./choices.ts";
import type { CaptureProps } from "./model.ts";

/** The body of the page that is showing. */
export function CapturePageBody({ page, ...props }: CaptureProps & { readonly page: CapturePage }) {
  const { draft, model } = props;
  const t = useT();
  if (page === "point") return <PointPage {...props} />;
  if (page === "label") return <LabelPage {...props} />;
  if (page === "finding") return <FindingPage {...props} />;
  if (page === "paddle")
    return (
      <YesNoPage
        title={t("field.capture.paddleQuestion")}
        hint={t("field.capture.paddleHint")}
        value={draft.paddlePresent}
        disabled={model.isBusy}
        onChoose={(paddlePresent) => {
          choose(props, { paddlePresent });
        }}
      />
    );
  if (page === "eggs")
    return (
      <YesNoPage
        title={t("field.capture.eggsQuestion")}
        hint={t("field.capture.eggsHint")}
        value={draft.hasEggs}
        disabled={model.isBusy}
        onChoose={(hasEggs) => {
          choose(props, { hasEggs });
        }}
      />
    );
  if (page === "photo") return <PhotoPage {...props} />;
  if (page === "bag") return <BagPage {...props} />;
  if (page === "prepare") return <PreparePage {...props} />;
  if (page === "conditions") return <ConditionsPage {...props} />;
  return <ConfirmPage {...props} />;
}
