import { useTranslation } from "react-i18next";
import { ErrorState } from "../../ui/ErrorState";
import { InlineNotice } from "../../ui/InlineNotice";
import { TypeEditor } from "./TypeEditor";
import { NewTypeEditor } from "./NewTypeEditor";
import { TypeSelectionLoading } from "./TypeSelectionLoading";
import { useTypeSelection } from "./use-type-selection";
import type { useW06 } from "./use-w-06";
import { isTypeAccessDenied } from "./type-access";
import { isCurrentTypeRead } from "./type-query-state";
export function TypeSelection({ controller }: { controller: ReturnType<typeof useW06> }) {
  const { t } = useTranslation();
  const selected = useTypeSelection(controller);
  if (isTypeAccessDenied(controller.query.error))
    return <TypeSelectionLoading error={controller.query.error} onRetry={selected.retryList} />;
  if (controller.isCreating) return <NewTypeEditor controller={controller} />;
  if (!selected.code) return null;
  if (isTypeAccessDenied(selected.query.error) || (!selected.query.data && !selected.item))
    return <TypeSelectionLoading error={selected.query.error} onRetry={selected.retry} />;
  if (!selected.item) return <InlineNotice tone="warning">{t("errors.api.notFound")}</InlineNotice>;
  const attributes = {
    scope: controller.scope,
    item: selected.item,
    isReady: isCurrentTypeRead(selected.query),
    onClose: controller.close,
    onReview: selected.review,
    onSaved: controller.configurationCode ? selected.saved : undefined,
  };
  return (
    <>
      {selected.query.error && <ErrorState onRetry={selected.retry} />}
      <TypeEditor key={selected.code} {...attributes} />
    </>
  );
}
