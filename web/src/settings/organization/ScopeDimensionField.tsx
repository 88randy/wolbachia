import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { useSessionIdentity } from "../../session/use-session-identity";
import type { BeginScopeLookup, ScopeDimensionChange } from "./scope-types";
import { ScopeModeSelect } from "./ScopeModeSelect";
import { ScopeCodeLookup } from "./ScopeCodeLookup";
import { ScopeReferences } from "./ScopeReferences";
import styles from "./organization.module.css";
interface Props {
  dimension: "centers" | "quadrants";
  value: Schemas["ScopeDimension"];
  onChange: ScopeDimensionChange;
  beginLookup: BeginScopeLookup;
}
export function ScopeDimensionField(props: Props) {
  const { dimension, value, onChange } = props;
  const { t } = useTranslation();
  const id = useId();
  const context = JSON.stringify(useSessionIdentity());
  return (
    <fieldset className={styles.fieldset}>
      <legend>
        {t(dimension === "centers" ? "orgAdmin.scope.centers" : "orgAdmin.scope.quadrants")}
      </legend>
      <ScopeModeSelect {...props} id={id} />
      {value.mode === "selected" && (
        <>
          <ScopeReferences dimension={dimension} value={value} onChange={onChange} />
          <ScopeCodeLookup key={context} {...props} id={`${id}-code`} />
        </>
      )}
    </fieldset>
  );
}
