/* eslint-disable max-lines-per-function, complexity -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { Download, Info } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageFrame } from "../../components/templates/PageFrame";
import { PageHeader } from "../../components/templates/PageHeader";
import { TextField } from "../../forms/TextField";
import { useCan } from "../../session/use-can";
import { useDocumentTitle } from "../../shell/use-document-title";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { InlineNotice } from "../../ui/InlineNotice";
import { Tooltip } from "../../ui/Tooltip";
import { DateRangeField } from "../toolbar/DateRangeField";
import { ExportChoice } from "./ExportChoice";
import { ExportHistory } from "./ExportHistory";
import { useOfficialExport } from "./use-official-export";
import type { Dataset, FileFormat } from "./use-official-export";

const DATASETS: readonly Dataset[] = ["releases", "readings", "lab_results"];
const FORMATS: readonly FileFormat[] = ["csv", "xlsx"];

/** W57: pick the data, the period, and download. The RFC comes out empty without an authorization. */
export function ExportsPage() {
  const { t } = useTranslation();
  const can = useCan();
  useDocumentTitle(t("regulatory.exports.title"));
  const [dataset, setDataset] = useState<Dataset>("releases");
  const [format, setFormat] = useState<FileFormat>("csv");
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  const [recipient, setRecipient] = useState("");
  const { status, start } = useOfficialExport();
  const ready = range.from !== undefined;
  return (
    <PageFrame>
      <PageHeader
        title={t("regulatory.exports.title")}
        description={t("regulatory.exports.description")}
      />
      <Card title={t("regulatory.exports.dataset")} headingLevel={2}>
        <div className="flex flex-col gap-6">
          <ExportChoice
            legend={t("regulatory.exports.dataset")}
            value={dataset}
            options={DATASETS.map((value) => ({
              value,
              label: t(`regulatory.exports.dataset.${value}`),
            }))}
            onChange={setDataset}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <DateRangeField
              label={t("regulatory.exports.dates")}
              from={range.from}
              to={range.to}
              onChange={setRange}
            />
            <ExportChoice
              legend={t("regulatory.exports.format")}
              value={format}
              options={FORMATS.map((value) => ({
                value,
                label: t(`regulatory.exports.format.${value}`),
              }))}
              onChange={setFormat}
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <TextField
                id="export-recipient"
                label={t("regulatory.exports.recipient")}
                hint={t("regulatory.exports.recipientHint")}
                value={recipient}
                maxLength={200}
                onChange={(event) => {
                  setRecipient(event.target.value);
                }}
              />
            </div>
            <Tooltip content={t("regulatory.exports.rfcTip")}>
              <button
                type="button"
                aria-label={t("regulatory.exports.rfcTip")}
                className="mb-2 grid size-8 place-items-center rounded-full text-ink-2 hover:bg-tint"
              >
                <Info aria-hidden="true" className="size-4" />
              </button>
            </Tooltip>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button
              size="lg"
              leadingIcon={<Download aria-hidden="true" />}
              loading={status.kind === "pending"}
              aria-disabled={!ready || !can("export.run") || undefined}
              onClick={() => {
                if (range.from === undefined) return;
                void start({
                  dataset,
                  format,
                  from: range.from,
                  to: range.to ?? range.from,
                  recipient: recipient.trim(),
                });
              }}
            >
              {t("regulatory.exports.download")}
            </Button>
            <p role="status" className="m-0 text-[13px] text-ink-2">
              {!ready && t("regulatory.exports.needDates")}
              {status.kind === "pending" && t("regulatory.exports.pending")}
              {status.kind === "done" && t("regulatory.exports.done")}
            </p>
          </div>
          {status.kind === "failed" && (
            <InlineNotice tone="critical">
              {status.reason === "tooMany" && t("regulatory.exports.tooMany")}
              {status.reason === "invalid" && t("regulatory.exports.invalidRange")}
              {status.reason === "generic" && t("regulatory.common.failed")}
            </InlineNotice>
          )}
        </div>
      </Card>
      {can("access_log.read") && <ExportHistory />}
    </PageFrame>
  );
}
