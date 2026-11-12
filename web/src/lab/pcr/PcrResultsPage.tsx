import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { unwrap } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Save } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DetailPage } from "../../components/templates/DetailPage";
import { useBreadcrumbLabel } from "../../shell/breadcrumb-labels";
import { NotFoundState } from "../../states/NotFoundState";
import { PendingState } from "../../states/PendingState";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { InlineNotice } from "../../ui/InlineNotice";
import { SelectMenu } from "../../ui/SelectMenu";
import { StatusPill } from "../../ui/StatusPill";
import { useToast } from "../../ui/toast-context";
import { useLabScope } from "../use-lab-scope";
import { SEROTYPES, pcrDetailOptions, pcrErrorKey } from "./pcr-api";
import type { PcrDetail, PcrOutcome, PcrPreview, PcrResultRow, PcrTarget } from "./pcr-api";
import { STATUS_TONE, outcomeKey, statusKey, targetKey } from "./pcr-status";
import { usePcrCommand, usePcrDownload } from "./use-pcr-command";

type ResultBody = PcrResultRow;
type Serotype = ResultBody["serotype"];

/** "Cargar resultados": a CSV from the external laboratory (preview first) or a grid by hand. */
export function PcrResultsPage() {
  const { code } = useParams({ strict: false });
  const scope = useLabScope();
  const query = useQuery(pcrDetailOptions(scope, code ?? ""));
  const { t } = useTranslation();
  useBreadcrumbLabel(`/lab/pcr/${code ?? ""}`, code);
  useBreadcrumbLabel(`/lab/pcr/${code ?? ""}/results`, t("pcr.results.title"));
  if (!code || query.data === null) return <NotFoundState />;
  if (!query.data) return <PendingState />;
  return <ResultsWorkspace batch={query.data} />;
}

function ResultsWorkspace({ batch }: { batch: PcrDetail }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const back = () => {
    showToast({ message: t("pcr.results.saved"), tone: "success" });
    void navigate({ to: "/lab/pcr/$code", params: { code: batch.code } });
  };
  const command = usePcrCommand(batch, back);
  const expected = ["received_by_lab", "results_received"].includes(batch.status);
  const save = (rows: ResultBody[]) => {
    command.run({ kind: "results", rows });
  };
  return (
    <DetailPage
      code={batch.code}
      title={t("pcr.results.title")}
      status={
        <StatusPill tone={STATUS_TONE[batch.status]}>{t(statusKey(batch.status))}</StatusPill>
      }
      subtitle={t("pcr.results.description")}
      notices={
        <>
          {!expected && <InlineNotice tone="warning">{t("pcr.results.notExpected")}</InlineNotice>}
          {command.error && <InlineNotice tone="critical">{command.error}</InlineNotice>}
        </>
      }
    >
      {expected && (
        <Tabs defaultValue="csv" className="flex flex-col gap-4">
          <TabsList className="w-fit">
            <TabsTrigger value="csv">{t("pcr.results.tabCsv")}</TabsTrigger>
            <TabsTrigger value="grid">{t("pcr.results.tabGrid")}</TabsTrigger>
          </TabsList>
          <TabsContent value="csv">
            <CsvUpload batch={batch} isSaving={command.isPending} onApply={save} />
          </TabsContent>
          <TabsContent value="grid">
            <ResultGrid batch={batch} isSaving={command.isPending} onApply={save} />
          </TabsContent>
        </Tabs>
      )}
    </DetailPage>
  );
}

interface ApplyProps {
  batch: PcrDetail;
  isSaving: boolean;
  onApply: (rows: ResultBody[]) => void;
}

function CsvUpload({ batch, isSaving, onApply }: ApplyProps) {
  const { t } = useTranslation();
  const scope = useLabScope();
  const download = usePcrDownload();
  const [preview, setPreview] = useState<PcrPreview>();
  const [problem, setProblem] = useState<string>();
  const check = useMutation({
    mutationFn: async (content: string) =>
      unwrap(
        await scope.client.POST("/api/v1/pcr-batches/{id}/results-preview/", {
          params: { path: { id: batch.id } },
          body: { content },
        }),
      ),
    onSuccess: (answer) => {
      setPreview(answer);
      setProblem(answer.file_error ? t(`pcr.file.${answer.file_error}` as MessageKey) : undefined);
    },
    onError: (caught) => {
      setProblem(t(pcrErrorKey(caught)));
    },
  });
  const ready = (preview?.rows ?? []).filter((row) => row.problems.length === 0);
  const hasErrors = (preview?.error_count ?? 0) > 0;
  return (
    <div className="flex flex-col gap-4">
      <Card title={t("pcr.results.chooseFile")}>
        <div className="flex flex-col gap-3">
          <p className="m-0 text-sm text-ink-2">{t("pcr.results.templateHint")}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              leadingIcon={<Download aria-hidden="true" />}
              onClick={() => {
                void download({ kind: "template", id: batch.id }, `${batch.code}-resultados.csv`);
              }}
            >
              {t("pcr.results.template")}
            </Button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-action px-4 py-2 text-[13px] font-semibold text-on-action">
              <FileSpreadsheet aria-hidden="true" className="size-4" />
              {t("pcr.results.chooseFile")}
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (!file) return;
                  void file.text().then((content) => {
                    check.mutate(content);
                  });
                }}
              />
            </label>
          </div>
          {problem && <InlineNotice tone="critical">{problem}</InlineNotice>}
        </div>
      </Card>
      {preview && !preview.file_error && (
        <Card title={t("pcr.results.previewTitle")}>
          <div className="flex flex-col gap-3">
            <p className="m-0 text-sm font-semibold" aria-live="polite">
              {t("pcr.results.previewSummary", {
                valid: preview.valid_count,
                errors: preview.error_count,
              })}
            </p>
            <div className="max-h-[28rem] overflow-auto rounded-xl border border-line">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-surface-muted text-left text-xs text-ink-2">
                  <tr>
                    <th className="px-3 py-2 text-right font-semibold">{t("pcr.col.line")}</th>
                    <th className="px-3 py-2 font-semibold">{t("pcr.col.code")}</th>
                    <th className="px-3 py-2 font-semibold">{t("pcr.col.targets")}</th>
                    <th className="px-3 py-2 font-semibold">{t("pcr.col.status")}</th>
                    <th className="px-3 py-2 font-semibold">{t("pcr.col.serotype")}</th>
                    <th className="px-3 py-2 text-right font-semibold">{t("pcr.col.ct")}</th>
                    <th className="px-3 py-2 font-semibold">{t("pcr.col.problems")}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr
                      key={row.line}
                      className={
                        row.problems.length
                          ? "border-t border-line bg-critical-bg"
                          : "border-t border-line"
                      }
                    >
                      <td className="px-3 py-2 text-right tabular-nums">{row.line}</td>
                      <td className="px-3 py-2 font-semibold">{row.sample_code}</td>
                      <td className="px-3 py-2">{row.target ? t(targetKey(row.target)) : "—"}</td>
                      <td className="px-3 py-2">
                        {row.outcome ? t(outcomeKey(row.outcome)) : "—"}
                      </td>
                      <td className="px-3 py-2">{row.serotype || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.ct_value ?? "—"}</td>
                      <td className="px-3 py-2">
                        {row.problems.length === 0 ? (
                          <span className="inline-flex items-center gap-1 text-success-fg">
                            <CheckCircle2 aria-hidden="true" className="size-4" />
                            {t("pcr.action.done")}
                          </span>
                        ) : (
                          <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-critical-fg">
                            {row.problems.map((error) => (
                              <li
                                key={`${error.field}-${error.code}`}
                                className="inline-flex items-center gap-1"
                              >
                                <AlertTriangle aria-hidden="true" className="size-4 flex-none" />
                                {t(
                                  `pcr.row.${error.code}` as MessageKey,
                                  error.params as Record<string, unknown>,
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hasErrors && <InlineNotice tone="warning">{t("pcr.results.fixFirst")}</InlineNotice>}
            <div className="flex justify-end">
              <Button
                leadingIcon={<Save aria-hidden="true" />}
                loading={isSaving}
                aria-disabled={hasErrors || ready.length === 0 || undefined}
                onClick={() => {
                  if (hasErrors || ready.length === 0) return;
                  onApply(
                    ready.map((row) => ({
                      sample_id: row.sample_id ?? "",
                      target: row.target as PcrTarget,
                      outcome: row.outcome as PcrOutcome,
                      serotype: row.serotype as Serotype,
                      ct_value: row.ct_value,
                    })),
                  );
                }}
              >
                {t("pcr.results.apply", { count: ready.length })}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

interface Draft {
  outcome: string;
  serotype: string;
  ct: string;
}

function ResultGrid({ batch, isSaving, onApply }: ApplyProps) {
  const { t } = useTranslation();
  const current = new Map(
    batch.results
      .filter((row) => row.current)
      .map((row) => [`${row.sample_id}:${row.target}`, row]),
  );
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [problem, setProblem] = useState<string>();
  const outcomes = [
    { value: "", label: t("pcr.results.choose") },
    ...(["positive", "negative", "invalid"] as const).map((value) => ({
      value,
      label: t(outcomeKey(value)),
    })),
  ];
  const serotypes = [
    { value: "", label: t("pcr.results.noSerotype") },
    ...SEROTYPES.map((value) => ({ value, label: value })),
  ];
  const ctProblem = (rows: readonly ResultBody[]) =>
    rows.some(
      (row) => typeof row.ct_value === "string" && !/^\d{1,2}(\.\d{1,2})?$/.test(row.ct_value),
    )
      ? t("pcr.row.pcr_ct_invalid", { min: 0, max: 60 })
      : undefined;
  const update = (key: string, patch: Partial<Draft>) => {
    setDrafts((previous) => ({
      ...previous,
      [key]: { outcome: "", serotype: "", ct: "", ...previous[key], ...patch },
    }));
  };
  const rows: ResultBody[] = Object.entries(drafts)
    .filter(([, draft]) => draft.outcome)
    .map(([key, draft]) => {
      const [sampleId = "", target = "dengue"] = key.split(":");
      return {
        sample_id: sampleId,
        target: target as PcrTarget,
        outcome: draft.outcome as PcrOutcome,
        serotype: (target === "dengue" && draft.outcome === "positive"
          ? draft.serotype
          : "") as Serotype,
        ct_value: draft.ct.trim() ? draft.ct.trim().replace(",", ".") : null,
      };
    });
  return (
    <Card title={t("pcr.results.tabGrid")}>
      <div className="flex flex-col gap-4">
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-surface-muted text-left text-xs text-ink-2">
              <tr>
                <th className="px-3 py-2 font-semibold">{t("pcr.col.code")}</th>
                <th className="px-3 py-2 font-semibold">{t("pcr.col.targets")}</th>
                <th className="px-3 py-2 font-semibold">{t("pcr.col.status")}</th>
                <th className="px-3 py-2 font-semibold">{t("pcr.col.serotype")}</th>
                <th className="px-3 py-2 font-semibold">{t("pcr.col.ct")}</th>
              </tr>
            </thead>
            <tbody>
              {batch.samples.flatMap((sample) =>
                batch.targets.map((target) => {
                  const key = `${sample.id}:${target}`;
                  const existing = current.get(key);
                  const draft = drafts[key];
                  const locked = existing !== undefined && existing.outcome !== "invalid";
                  return (
                    <tr key={key} className="border-t border-line">
                      <td className="px-3 py-2 font-semibold">{sample.code}</td>
                      <td className="px-3 py-2">{t(targetKey(target))}</td>
                      <td className="w-48 px-3 py-2">
                        {locked ? (
                          <span className="text-ink-2">
                            {t(outcomeKey(existing.outcome))} · {t("pcr.results.locked")}
                          </span>
                        ) : (
                          <SelectMenu
                            id={`outcome-${key}`}
                            ariaLabel={`${sample.code} ${t(targetKey(target))}`}
                            value={draft?.outcome ?? ""}
                            options={outcomes}
                            onValueChange={(value) => {
                              update(key, { outcome: value });
                            }}
                          />
                        )}
                      </td>
                      <td className="w-40 px-3 py-2">
                        {target === "dengue" && !locked && draft?.outcome === "positive" ? (
                          <SelectMenu
                            id={`serotype-${key}`}
                            ariaLabel={`${sample.code} ${t("pcr.col.serotype")}`}
                            value={draft.serotype}
                            options={serotypes}
                            onValueChange={(value) => {
                              update(key, { serotype: value });
                            }}
                          />
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                      <td className="w-28 px-3 py-2">
                        {!locked && draft?.outcome && draft.outcome !== "invalid" ? (
                          <input
                            aria-label={`${sample.code} Ct`}
                            inputMode="decimal"
                            maxLength={6}
                            value={draft.ct}
                            className="h-9 w-20 rounded-lg border border-line bg-surface px-2 text-right text-sm tabular-nums"
                            onChange={(event) => {
                              update(key, { ct: event.currentTarget.value });
                            }}
                          />
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
        {problem && <InlineNotice tone="warning">{problem}</InlineNotice>}
        <div className="flex justify-end">
          <Button
            leadingIcon={<Save aria-hidden="true" />}
            loading={isSaving}
            onClick={() => {
              const reason = rows.length === 0 ? t("pcr.results.nothing") : ctProblem(rows);
              setProblem(reason);
              if (!reason) onApply(rows);
            }}
          >
            {t("pcr.results.applyGrid")}
          </Button>
        </div>
      </div>
    </Card>
  );
}
