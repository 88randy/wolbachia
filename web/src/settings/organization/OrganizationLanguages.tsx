import { useTranslation } from "react-i18next";
import { Switch } from "../../ui/Switch";
import type { OrganizationFormController } from "./use-organization-form";
export function OrganizationLanguages({ controller }: { controller: OrganizationFormController }) {
  const { t } = useTranslation();
  const { settings, change } = controller;
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
      <legend className="mb-1.5 text-[13px] font-semibold text-ink">
        {t("orgAdmin.organization.languages")}
      </legend>
      {["es-MX", "en"].map((language) => (
        <Switch
          key={language}
          label={t(
            language === "en" ? "orgAdmin.organization.english" : "orgAdmin.organization.spanish",
          )}
          isOn={settings.languages.includes(language)}
          onChange={(isOn) => {
            change(
              "languages",
              isOn
                ? [...settings.languages, language]
                : settings.languages.filter((item) => item !== language),
            );
          }}
        />
      ))}
    </fieldset>
  );
}
