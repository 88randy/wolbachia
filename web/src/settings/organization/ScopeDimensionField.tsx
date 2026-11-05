import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useSessionIdentity } from "../../session/use-session-identity";
import type { BeginScopeLookup, ScopeDimensionEditor, ScopeDimensionName } from "./scope-types";
import { ScopeModeSelect } from "./ScopeModeSelect";
import { ScopeCodeLookup } from "./ScopeCodeLookup";
import { ScopeReferences } from "./ScopeReferences";
import styles from "./organization.module.css";
interface Props {
  dimension: ScopeDimensionName;
  editor: ScopeDimensionEditor;
  beginLookup: BeginScopeLookup;
}
export function ScopeDimensionField(props: Props) {
  const { dimension, editor } = props;
  const { value, change: onChange } = editor;
  const { t } = useTranslation();
  const id = useId();
  const context = JSON.stringify(useSessionIdentity());
  return (
    <fieldset className={styles.fieldset}>
      <legend>
        {t(dimension === "centers" ? "orgAdmin.scope.centers" : "orgAdmin.scope.quadrants")}
      </legend>
      <ScopeModeSelect dimension={dimension} value={value} onChange={onChange} id={id} />
      {value.mode === "selected" && (
        <>
          <ScopeReferences dimension={dimension} value={value} onChange={onChange} />
          <ScopeCodeLookup
            key={`${context}|${String(editor.intentRevision)}`}
            {...props}
            id={`${id}-code`}
          />
        </>
      )}
    </fieldset>
  );
}
