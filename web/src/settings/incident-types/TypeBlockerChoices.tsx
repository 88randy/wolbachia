import { useTranslation } from "react-i18next";
import type { TypeFieldProps } from "./type-editor-types";
import type { Schemas } from "@wolbachia/api-client";
import styles from "./incident-types.module.css";
const KINDS = [
  { value: "dispatch", key: "incidents.blocker.dispatch" },
  { value: "quadrant_closure", key: "incidents.blocker.quadrantClosure" },
] as const;
export function TypeBlockerChoices({ draft, change }: TypeFieldProps) {
  const { t } = useTranslation();
  function toggle(kind: Schemas["BlockerKindsEnum"], isChecked: boolean) {
    change(
      "blocker_kinds",
      isChecked
        ? [...(draft.blocker_kinds ?? []), kind]
        : draft.blocker_kinds?.filter((value) => value !== kind),
    );
  }
  return (
    <fieldset className={styles.group}>
      <legend>{t("incidentTypes.field.blockers")}</legend>
      {KINDS.map(({ value, key }) => (
        <label key={value}>
          <input
            type="checkbox"
            checked={draft.blocker_kinds?.includes(value) ?? false}
            onChange={(event) => {
              toggle(value, event.target.checked);
            }}
          />
          {t(key)}
        </label>
      ))}
    </fieldset>
  );
}
