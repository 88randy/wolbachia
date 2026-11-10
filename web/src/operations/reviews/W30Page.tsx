import { useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useReviewScope } from "./use-review-scope";
import { useMe } from "../../session/use-me";
import { useDocumentTitle } from "../../shell/use-document-title";
import { InlineNotice } from "../../ui/InlineNotice";
import { ReviewTray } from "./ReviewTray";
import { ReviewRecord } from "./ReviewRecord";
import styles from "./reviews.module.css";

export function W30Page() {
  const { t } = useTranslation();
  const scope = useReviewScope();
  const me = useMe();
  const search = useSearch({ strict: false });
  const item = "item" in search && typeof search.item === "string" ? search.item : undefined;
  const hasDimension = (mode: typeof me.scope.centers) =>
    mode.mode === "all" || (mode.mode === "selected" && mode.ids.length > 0);
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
    return <InlineNotice tone="warning">{t("reviews.workspace.denied")}</InlineNotice>;
  return (
    <section className={styles.page} key={owner}>
      <h1>{t("reviews.workspace.title")}</h1>
      <ReviewTray scope={scope} />
      {item && <ReviewRecord key={item} scope={scope} id={item} />}
    </section>
  );
}
