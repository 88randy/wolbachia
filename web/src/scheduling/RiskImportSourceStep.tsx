import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { useFormatCalendarDate } from "../format/use-formatters";
import { SelectMenu } from "../ui/SelectMenu";
import { weekNumberOf } from "./week-dates";
import type { RiskImport } from "./use-risk-import";

export function RiskImportSourceStep({ flow }: { flow: RiskImport }) {
  const { t } = useTranslation();
  const formatDay = useFormatCalendarDate();
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="import-source" className="text-[13px] font-semibold text-ink">
          {t("scheduling.import.source")}
        </label>
        <SelectMenu
          id="import-source"
          value={flow.source}
          onValueChange={(value) => {
            flow.setSource(value as Schemas["SourceEnum"]);
          }}
          options={[
            { value: "official_import", label: t("scheduling.risk.sourceOfficial") },
            { value: "company_rule", label: t("scheduling.risk.sourceCompany") },
          ]}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="import-week" className="text-[13px] font-semibold text-ink">
          {t("scheduling.import.week")}
        </label>
        <SelectMenu
          id="import-week"
          value={flow.week}
          onValueChange={flow.setWeek}
          options={flow.weekChoices.map((value) => ({
            value,
            label: t("scheduling.import.weekOption", {
              week: weekNumberOf(value),
              day: formatDay(value),
            }),
          }))}
        />
      </div>
    </div>
  );
}
