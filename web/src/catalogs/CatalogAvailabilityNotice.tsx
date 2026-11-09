import { Button } from "../ui/Button";
import { InlineNotice } from "../ui/InlineNotice";
import { useTranslation } from "react-i18next";
import { useCatalogRefresh } from "./use-catalog-refresh";
import type { CatalogEditor } from "./use-catalog-editor";
function useReviewAction(editor: CatalogEditor, isReady: boolean) {
  const { t } = useTranslation();
  const refresh = useCatalogRefresh();
  if (editor.error !== "refresh.availability.uncertain") return;
  return (
    <Button
      variant="secondary"
      disabled={editor.write.isBusy || !isReady}
      onClick={() => {
        if (editor.isCurrent()) void refresh();
      }}
    >
      {t("refresh.availability.review")}
    </Button>
  );
}
export function CatalogAvailabilityNotice({
  editor,
  isReady,
}: {
  editor: CatalogEditor;
  isReady: boolean;
}) {
  const { t } = useTranslation();
  const action = useReviewAction(editor, isReady);
  if (!editor.error) return null;
  return (
    <InlineNotice tone="warning" action={action}>
      <span role="alert">{t(editor.error)}</span>
    </InlineNotice>
  );
}
