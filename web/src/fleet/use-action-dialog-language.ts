import { useMemo } from "react";
import { useTranslation } from "react-i18next";
/** Scope action wording to the existing VoidDialog without changing its validation,
 * focus lifecycle or the global catalogs used by other screens. The resource store is forked. */
export function useActionDialogLanguage() {
  const { i18n, t } = useTranslation();
  const language = i18n.language;
  return useMemo(() => {
    const local = i18n.cloneInstance({ forkResourceStore: true, lng: language });
    local.addResource(
      language,
      "translation",
      "voiding.error.blocked",
      t("errors.api.motorcycleInUse"),
    );
    return local;
  }, [i18n, language, t]);
}
