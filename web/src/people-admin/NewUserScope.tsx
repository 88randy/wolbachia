/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): declarative screen pieces. */
import { useTranslation } from "react-i18next";
import styles from "../void/void-dialog.module.css";
import type { NewUserForm } from "./use-new-user-form";

interface Props {
  form: NewUserForm;
  centers: readonly { id: string; name: string }[];
}

/** All centers (only when the admin has them all) or the chosen centers. */
export function NewUserScope({ form, centers }: Props) {
  const { t } = useTranslation();
  const { values, change } = form;
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className={styles.label}>{t("users.new.scope")}</legend>
      <p className={styles.hint}>{t("users.new.scopeHint")}</p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          name="new-user-scope"
          checked={values.scopeMode === "selected"}
          onChange={() => {
            change({ scopeMode: "selected" });
          }}
        />
        {t("users.new.scopeSelected")}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          name="new-user-scope"
          checked={values.scopeMode === "all"}
          disabled={!form.canGrantAllCenters}
          onChange={() => {
            change({ scopeMode: "all" });
          }}
        />
        {t("users.new.scopeAll")}
      </label>
      {values.scopeMode === "selected" && (
        <div role="group" aria-label={t("users.new.scopeCenters")} className="flex flex-col gap-1">
          {centers.map((center) => (
            <label key={center.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.centerIds.includes(center.id)}
                onChange={() => {
                  form.toggleCenter(center.id);
                }}
              />
              {center.name}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
