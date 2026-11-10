import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { cn } from "@/lib/utils";
import { useFormatCalendarDate } from "../format/use-formatters";
import { SelectMenu } from "../ui/SelectMenu";
import { weekNumberOf } from "./week-dates";
import type { RiskImport } from "./use-risk-import";

type Source = Schemas["SourceEnum"];

const SOURCES: readonly { value: Source; label: string }[] = [
  { value: "official_import", label: "scheduling.risk.sourceOfficial" },
  { value: "company_rule", label: "scheduling.risk.sourceCompany" },
];

export function RiskImportSourceStep({ flow }: { flow: RiskImport }) {
  const { t } = useTranslation();
  const formatDay = useFormatCalendarDate();
  return (
    <div className="flex flex-col gap-5">
      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className="mb-1 text-[13px] font-semibold text-ink">
          {t("scheduling.import.source")}
        </legend>
        <p className="m-0 text-[13px] text-ink-2">{t("scheduling.import.sourceHelp")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {SOURCES.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border bg-surface p-4 text-sm font-semibold text-ink",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-action",
                flow.source === option.value
                  ? "border-action bg-tint ring-1 ring-action"
                  : "border-line-strong",
              )}
            >
              <input
                type="radio"
                name="import-source"
                value={option.value}
                checked={flow.source === option.value}
                onChange={() => {
                  flow.setSource(option.value);
                }}
                className="size-4 accent-action"
              />
              {t(option.label as "scheduling.risk.sourceOfficial")}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex max-w-sm flex-col gap-1.5">
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
              from: formatDay(value),
            }),
          }))}
        />
      </div>
    </div>
  );
}
