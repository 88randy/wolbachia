import { useTranslation } from "react-i18next";
import type { ScopeEditor } from "./use-scope-editor";
import { ScopeDimensionField } from "./ScopeDimensionField";
interface Props {
  editor: Pick<ScopeEditor, "scope" | "setScope" | "lookups">;
}
export function ScopeFields({ editor }: Props) {
  const { t } = useTranslation();
  const { scope, setScope } = editor;
  return (
    <>
      <p>{t("orgAdmin.scope.hint")}</p>
      <ScopeDimensionField
        dimension="centers"
        value={scope.centers}
        beginLookup={editor.lookups.begin}
        onChange={(update) => {
          setScope((current) => ({ ...current, centers: update(current.centers) }));
        }}
      />
      <ScopeDimensionField
        dimension="quadrants"
        value={scope.quadrants}
        beginLookup={editor.lookups.begin}
        onChange={(update) => {
          setScope((current) => ({ ...current, quadrants: update(current.quadrants) }));
        }}
      />
    </>
  );
}
