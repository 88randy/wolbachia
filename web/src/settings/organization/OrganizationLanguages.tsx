import { useTranslation } from "react-i18next";
import type { OrganizationFormController } from "./use-organization-form";
export function OrganizationLanguages({ controller }: { controller: OrganizationFormController }) {
  const { t } = useTranslation();
  const { settings, change } = controller;
  return (
    <fieldset>
      <legend>{t("orgAdmin.organization.languages")}</legend>
      {["es-MX", "en"].map((language) => (
        <label key={language}>
          <input
            type="checkbox"
            checked={settings.languages.includes(language)}
            onChange={(event) => {
              change(
                "languages",
                event.target.checked
                  ? [...settings.languages, language]
                  : settings.languages.filter((item) => item !== language),
              );
            }}
          />
          {t(language === "en" ? "orgAdmin.organization.english" : "orgAdmin.organization.spanish")}
        </label>
      ))}
    </fieldset>
  );
}
