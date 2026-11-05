import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { useMe } from "../../session/use-me";
import { useScopeCode } from "./use-scope-code";
import { ScopeModeSelect } from "./ScopeModeSelect";
import { ScopeCodeInput } from "./ScopeCodeInput";
import { ScopeReferences } from "./ScopeReferences";
import styles from "./organization.module.css";
interface Props {
  dimension: "centers" | "quadrants";
  value: Schemas["ScopeDimension"];
  onChange: (value: Schemas["ScopeDimension"]) => void;
}
export function ScopeDimensionField(props: Props) {
  const { dimension, value, onChange } = props;
  const { t } = useTranslation();
  const id = useId();
  const canRead = useMe().permissions.includes(
    dimension === "centers" ? "center.read" : "quadrant.read",
  );
  const lookup = useScopeCode(dimension, (identifier) => {
    onChange({ mode: "selected", ids: [...new Set([...value.ids, identifier])].sort() });
  });
  return (
    <fieldset className={styles.fieldset}>
      <legend>
        {t(dimension === "centers" ? "orgAdmin.scope.centers" : "orgAdmin.scope.quadrants")}
      </legend>
      <ScopeModeSelect {...props} id={id} />
      {value.mode === "selected" && (
        <>
          <ScopeReferences dimension={dimension} value={value} onChange={onChange} />
          {canRead ? (
            <ScopeCodeInput id={`${id}-code`} lookup={lookup} />
          ) : (
            <p>{t("orgAdmin.scope.unavailable")}</p>
          )}
        </>
      )}
    </fieldset>
  );
}
