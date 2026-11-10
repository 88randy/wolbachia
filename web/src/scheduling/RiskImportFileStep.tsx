import { FileUp } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import type { RiskImport } from "./use-risk-import";

export function RiskImportFileStep({ flow }: { flow: RiskImport }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-[13px] font-semibold text-ink">
          {t("scheduling.import.file")}
        </label>
        <Input
          id={id}
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            flow.setFile(event.target.files?.[0] ?? null);
          }}
        />
        {flow.file && (
          <p className="m-0 flex items-center gap-2 text-[13px] text-ink-2">
            <FileUp aria-hidden="true" className="size-4" />
            {flow.file.name}
          </p>
        )}
      </div>
      <div className="rounded-xl bg-surface-muted p-4 text-[13px] text-ink-2">
        <p className="m-0 font-semibold text-ink">{t("scheduling.import.formatTitle")}</p>
        <p className="mt-1 mb-0">{t("scheduling.import.formatHint")}</p>
        <pre className="mt-2 mb-0 overflow-x-auto rounded-lg bg-surface p-3 text-xs">
          {"block_code,category,protocol\nMZ-0123,high,Revisión semanal"}
        </pre>
      </div>
    </div>
  );
}
