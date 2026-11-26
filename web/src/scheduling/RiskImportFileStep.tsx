import { useQuery } from "@tanstack/react-query";
import { Download, FileUp } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useApiClient } from "../api/ApiClientProvider";
import { useSessionIdentity } from "../session/use-session-identity";
import { Button } from "../ui/Button";
import { blocksDirectoryOptions } from "./scheduling-queries";
import { downloadText, riskTemplate } from "./risk-template";
import type { RiskImport } from "./use-risk-import";

const EXAMPLE = "block_code,category,protocol\nMZ-0123,high,Revisión semanal\nMZ-0124,low,";

/** Step 2: pick or drop the CSV, with the format explained and, when possible, a template. */
export function RiskImportFileStep({ flow }: { flow: RiskImport }) {
  const { t } = useTranslation();
  const client = useApiClient();
  const identity = useSessionIdentity();
  const input = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);
  const blocks = useQuery(blocksDirectoryOptions(client, identity)).data ?? [];
  const pick = (file: File | undefined) => {
    if (file) flow.setFile(file);
  };
  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={() => {
          setIsOver(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsOver(false);
          pick(event.dataTransfer.files[0]);
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center",
          isOver ? "border-action bg-tint" : "border-line-strong bg-surface-muted",
        )}
      >
        <FileUp aria-hidden="true" className="size-8 text-action" />
        <p className="m-0 text-sm font-semibold text-ink" aria-live="polite">
          {flow.file ? flow.file.name : t("scheduling.import.noFile")}
        </p>
        <input
          ref={input}
          id="risk-file"
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          tabIndex={-1}
          aria-label={t("scheduling.import.file")}
          onChange={(event) => {
            pick(event.target.files?.[0]);
          }}
        />
        <Button variant={flow.file ? "tertiary" : "primary"} onClick={() => input.current?.click()}>
          {t(flow.file ? "scheduling.import.changeFile" : "scheduling.import.chooseFile")}
        </Button>
      </div>
      <div className="flex flex-col gap-2 rounded-xl bg-surface-muted p-4 text-[13px] text-ink-2">
        <p className="m-0 font-semibold text-ink">{t("scheduling.import.formatTitle")}</p>
        <p className="m-0">{t("scheduling.import.formatHint")}</p>
        <pre className="m-0 overflow-x-auto rounded-lg bg-surface p-3 text-xs text-ink">
          {EXAMPLE}
        </pre>
        {blocks.length > 0 && (
          <Button
            variant="tertiary"
            leadingIcon={<Download aria-hidden="true" />}
            onClick={() => {
              downloadText(
                t("scheduling.import.templateName"),
                riskTemplate(blocks.map((block) => block.code)),
              );
            }}
          >
            {t("scheduling.import.template")}
          </Button>
        )}
      </div>
    </div>
  );
}
