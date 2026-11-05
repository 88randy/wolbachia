import { useTranslation } from "react-i18next";
import type { ScopeEditor } from "./use-scope-editor";
import { ScopeDimensionField } from "./ScopeDimensionField";
interface Props {
  editor: Pick<ScopeEditor, "centers" | "quadrants" | "lookups">;
}
export function ScopeFields({ editor }: Props) {
  const { t } = useTranslation();
  return (
    <>
      <p>{t("orgAdmin.scope.hint")}</p>
      <ScopeDimensionField
        dimension="centers"
        editor={editor.centers}
        beginLookup={editor.lookups.begin}
      />
      <ScopeDimensionField
        dimension="quadrants"
        editor={editor.quadrants}
        beginLookup={editor.lookups.begin}
      />
    </>
  );
}
