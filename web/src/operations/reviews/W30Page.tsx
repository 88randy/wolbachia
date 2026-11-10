import { useSearch } from "@tanstack/react-router";
import { MousePointerClick } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageFrame } from "../../components/templates/PageFrame";
import { PageHeader } from "../../components/templates/PageHeader";
import { useMe } from "../../session/use-me";
import { useDocumentTitle } from "../../shell/use-document-title";
import { InlineNotice } from "../../ui/InlineNotice";
import { StateFrame } from "../../ui/StateFrame";
import { ReviewRecord } from "./ReviewRecord";
import { ReviewTray } from "./ReviewTray";
import { useReviewScope } from "./use-review-scope";

type Dimension = ReturnType<typeof useMe>["scope"]["centers"];
const hasDimension = (mode: Dimension) =>
  mode.mode === "all" || (mode.mode === "selected" && mode.ids.length > 0);

/** W30: the list on the left, the chosen record with its decision buttons on the right. */
export function W30Page() {
  const { t } = useTranslation();
  const scope = useReviewScope();
  const me = useMe();
  const search = useSearch({ strict: false });
  const item = "item" in search && typeof search.item === "string" ? search.item : undefined;
  const hasAccess =
    me.permissions.includes("review_item.read") &&
    hasDimension(me.scope.centers) &&
    hasDimension(me.scope.quadrants);
  const owner = JSON.stringify([
    me.user.id,
    me.organization?.slug,
    me.permissions.includes("review_item.decide"),
  ]);
  useDocumentTitle(t("reviews.workspace.title"));
  if (!hasAccess)
    return (
      <PageFrame>
        <InlineNotice tone="warning">{t("reviews.workspace.denied")}</InlineNotice>
      </PageFrame>
    );
  return (
    <PageFrame key={owner}>
      <PageHeader
        title={t("reviews.workspace.title")}
        description={t("reviews.workspace.purpose")}
      />
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]">
        <div className="min-w-0">
          <ReviewTray scope={scope} />
        </div>
        <div className="min-w-0 xl:sticky xl:top-4">
          {item ? (
            <ReviewRecord key={item} scope={scope} id={item} />
          ) : (
            <div className="rounded-2xl border border-dashed border-line-strong bg-surface">
              <StateFrame icon={MousePointerClick} message={t("reviews.workspace.pick")} />
            </div>
          )}
        </div>
      </div>
    </PageFrame>
  );
}
