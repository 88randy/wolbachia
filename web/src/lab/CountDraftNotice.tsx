import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import type { useCountForm } from "./use-count-form";
export function CountDraftNotice({
  form,
  isLocked,
}: {
  form: ReturnType<typeof useCountForm>;
  isLocked: boolean;
}) {
  const { t } = useTranslation();
  return form.isRestored ? (
    <p>
      {t("lab.draft.restored")}{" "}
      <Button variant="ghost" aria-disabled={isLocked} onClick={form.discard}>
        {t("lab.draft.discard")}
      </Button>
    </p>
  ) : null;
}
