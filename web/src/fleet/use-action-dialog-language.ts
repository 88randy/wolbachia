import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { MotorcycleAction } from "./use-motorcycle-action";
/** Scope action wording to the existing VoidDialog without changing its validation,
 * focus lifecycle or the global catalogs used by other screens. The resource store is forked. */
export function useActionDialogLanguage(action: MotorcycleAction) {
  const { i18n, t } = useTranslation();
  const language = i18n.language;
  return useMemo(() => {
    const local = i18n.cloneInstance({ forkResourceStore: true, lng: language });
    local.addResource(
      language,
      "translation",
      "voiding.error.blocked",
      t(action === "void" ? "errors.api.motorcycleInUse" : "errors.api.motorcycleNotBlocked"),
    );
    if (action === "void") return local;
    const overrides = {
      "voiding.dialog.title": t("fleet.unblock.title"),
      "voiding.dialog.hint": t("fleet.unblock.hint"),
      "voiding.dialog.confirm": t("fleet.unblock.confirm"),
      "voiding.dialog.busy": t("fleet.unblock.busy"),
      "voiding.error.title": t("fleet.unblock.failure"),
      "common.fields.voidReason": t("fleet.unblock.reason"),
    };
    local.addResources(language, "translation", overrides);
    return local;
  }, [action, i18n, language, t]);
}
