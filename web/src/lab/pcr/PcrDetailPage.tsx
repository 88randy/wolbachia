import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { ApiError } from "@wolbachia/api-client";
import { Check, CheckCheck, Download, FileUp, PackageCheck, Send, Truck, Upload } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { DetailPage } from "../../components/templates/DetailPage";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { useFormatDate } from "../../format/use-formatters";
import { useBreadcrumbLabel } from "../../shell/breadcrumb-labels";
import { useCan } from "../../session/use-can";
import { NotFoundState } from "../../states/NotFoundState";
import { PendingState } from "../../states/PendingState";
import { Button } from "../../ui/Button";
import { buttonVariants } from "../../ui/button-variants";
import { Card } from "../../ui/Card";
import { CardMenu } from "../../ui/CardMenu";
import { EmptyValue } from "../../ui/EmptyValue";
import { ErrorState } from "../../ui/ErrorState";
import { InlineNotice } from "../../ui/InlineNotice";
import { StatusPill } from "../../ui/StatusPill";
import { useLabScope } from "../use-lab-scope";
import { Fact, FactGrid } from "./PcrFields";
import { FilePicker, ReasonDialog, ReceiveDialog, ShipDialog } from "./PcrDialogs";
import { PCR_MANAGE, pcrDetailOptions } from "./pcr-api";
import type { PcrDetail } from "./pcr-api";
import { FLOW, NEXT_ACTION, STATUS_TONE, outcomeKey, outcomeTone, statusKey, targetKey } from "./pcr-status";
import { usePcrCommand, usePcrDownload, usePcrUpload } from "./use-pcr-command";

/** One PCR test by its human code. */
export function PcrDetailPage() {
  const { code } = useParams({ strict: false });
  const { t } = useTranslation();
  const scope = useLabScope();
  const query = useQuery(pcrDetailOptions(scope, code ?? ""));
  useBreadcrumbLabel(`/lab/pcr/${code ?? ""}`, code);
  if (!code || query.data === null) return <NotFoundState />;
  if (query.error instanceof ApiError && [403, 404].includes(query.error.status)) return <NotFoundState />;
  if (query.data) return <PcrRecord batch={query.data} />;
  if (query.error)
    return (
      <ErrorState
        message={t("pcr.detail.loadFailed")}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  return <PendingState />;
}

type Dialogs = "ship" | "receive" | "undo" | "void" | { resultId: string } | null;

function PcrRecord({ batch }: { batch: PcrDetail }) {
  const { t } = useTranslation();
  const can = useCan();
  const formatDate = useFormatDate();
  const formatDateTime = useFormatDateTime();
  const [dialog, setDialog] = useState<Dialogs>(null);
  const command = usePcrCommand(batch);
  const manage = can(PCR_MANAGE);
  const next = NEXT_ACTION[batch.status];
  const live = batch.status !== "voided" && batch.status !== "closed";
  const primary = manage && next && (
    next === "results" ? (
      <Link
        to="/lab/pcr/$code/results"
        params={{ code: batch.code }}
        className={buttonVariants({ variant: "primary", size: "md" })}
      >
        <Upload aria-hidden="true" />
        {t("pcr.action.results")}
      </Link>
    ) : (
      <Button
        leadingIcon={ACTION_ICON[next]}
        loading={command.isPending}
        onClick={() => {
          if (next === "ship" || next === "receive") setDialog(next);
          else command.run({ kind: next });
        }}
      >
        {t(`pcr.action.${next}`)}
      </Button>
    )
  );
  const secondary =
    manage && batch.status === "results_received" ? (
      <Link
        to="/lab/pcr/$code/results"
        params={{ code: batch.code }}
        className={buttonVariants({ variant: "secondary", size: "md" })}
      >
        <Upload aria-hidden="true" />
        {t("pcr.action.results")}
      </Link>
    ) : null;
  const menu =
    manage && live ? (
      <CardMenu
        items={[
          {
            label: t("pcr.action.undo"),
            onSelect: () => {
              setDialog("undo");
            },
            disabled: batch.status === "preparing",
          },
          {
            label: t("pcr.action.void"),
            onSelect: () => {
              setDialog("void");
            },
          },
        ]}
      />
    ) : null;
  const targets = batch.targets.map((target) => t(targetKey(target))).join(" · ");
  return (
    <DetailPage
      code={t("pcr.list.title")}
      title={batch.code}
      status={<StatusPill tone={STATUS_TONE[batch.status]}>{t(statusKey(batch.status))}</StatusPill>}
      description={`${batch.external_lab.name} · ${targets}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {secondary}
          {primary}
          {menu}
        </div>
      }
      notices={
        <>
          {batch.status === "voided" && <InlineNotice tone="critical">{t("pcr.detail.voidedNotice")}</InlineNotice>}
          {batch.status === "closed" && <InlineNotice tone="success">{t("pcr.detail.done")}</InlineNotice>}
        </>
      }
      aside={<History batch={batch} />}
    >
      <Stepper batch={batch} />
      <Card title={t("pcr.detail.facts")}>
        <FactGrid>
          <Fact label={t("pcr.col.lab")}>{batch.external_lab.name}</Fact>
          <Fact label={t("pcr.detail.contact")}>{batch.external_lab.contact || <EmptyValue />}</Fact>
          <Fact label={t("pcr.detail.address")}>{batch.external_lab.address || <EmptyValue />}</Fact>
          <Fact label={t("pcr.col.targets")}>{targets}</Fact>
          <Fact label={t("pcr.detail.createdBy")}>{batch.author_name || <EmptyValue />}</Fact>
          <Fact label={t("pcr.detail.createdAt")}>{formatDate(batch.created_at)}</Fact>
          <Fact label={t("pcr.col.shippedAt")}>{batch.shipped_at ? formatDate(batch.shipped_at) : <EmptyValue />}</Fact>
          {batch.notes && <Fact label={t("pcr.detail.notes")}>{batch.notes}</Fact>}
        </FactGrid>
      </Card>
      <SamplesCard batch={batch} onVoidResult={(resultId) => {
        setDialog({ resultId });
      }} canManage={manage && live} formatDateTime={formatDateTime} />
      <ReportCard batch={batch} canManage={manage} />
      <ShipDialog batch={batch} open={dialog === "ship"} onOpenChange={(open) => { setDialog(open ? "ship" : null); }} />
      <ReceiveDialog batch={batch} open={dialog === "receive"} onOpenChange={(open) => { setDialog(open ? "receive" : null); }} />
      {dialog !== null && dialog !== "ship" && dialog !== "receive" && (
        <ReasonDialog
          batch={batch}
          mode={dialog}
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
        />
      )}
    </DetailPage>
  );
}

const ACTION_ICON = {
  ready: <PackageCheck aria-hidden="true" />,
  ship: <Truck aria-hidden="true" />,
  receive: <CheckCheck aria-hidden="true" />,
  close: <Check aria-hidden="true" />,
} as const;

function Stepper({ batch }: { batch: PcrDetail }) {
  const { t } = useTranslation();
  const current = FLOW.indexOf(batch.status);
  return (
    <Card title={t("pcr.detail.progress")}>
      <ol className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 xl:grid-cols-6">
        {FLOW.map((status, index) => {
          const done = current >= 0 && index < current;
          const isCurrent = index === current;
          return (
            <li
              key={status}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-semibold",
                done && "border-success/30 bg-success/10 text-success",
                isCurrent && "border-action bg-action text-on-action",
                !done && !isCurrent && "border-line bg-surface text-ink-3",
              )}
            >
              <span
                className={cn(
                  "grid size-6 flex-none place-items-center rounded-full text-xs",
                  done ? "bg-success text-on-action" : isCurrent ? "bg-surface text-action-strong" : "bg-surface-muted",
                )}
              >
                {done ? <Check aria-hidden="true" className="size-3.5" /> : index + 1}
              </span>
              {t(statusKey(status))}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function SamplesCard({
  batch,
  canManage,
  onVoidResult,
  formatDateTime,
}: {
  batch: PcrDetail;
  canManage: boolean;
  onVoidResult: (resultId: string) => void;
  formatDateTime: (iso: string) => string;
}) {
  const { t } = useTranslation();
  const current = new Map(
    batch.results.filter((row) => row.current).map((row) => [`${row.sample_id}:${row.target}`, row]),
  );
  const history = batch.results.filter((row) => !row.current);
  return (
    <Card title={t("pcr.detail.samples", { count: batch.samples.length })}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="text-left text-xs text-ink-2">
            <tr className="border-b border-line">
              <th className="px-3 py-2 font-semibold">{t("pcr.col.code")}</th>
              <th className="px-3 py-2 font-semibold">{t("pcr.col.quadrant")}</th>
              <th className="px-3 py-2 font-semibold">{t("pcr.col.week")}</th>
              {batch.targets.map((target) => (
                <th key={target} className="px-3 py-2 font-semibold">
                  {t(targetKey(target))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {batch.samples.map((sample) => (
              <tr key={sample.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2 font-semibold">{sample.code}</td>
                <td className="px-3 py-2">{sample.quadrant_name ?? sample.quadrant_code ?? <EmptyValue />}</td>
                <td className="px-3 py-2">{sample.epi_week ?? <EmptyValue />}</td>
                {batch.targets.map((target) => {
                  const result = current.get(`${sample.id}:${target}`);
                  if (!result)
                    return (
                      <td key={target} className="px-3 py-2 text-ink-3">
                        {t("pcr.outcome.pending")}
                      </td>
                    );
                  const lockable = target === "wolbachia" && result.outcome !== "invalid";
                  return (
                    <td key={target} className="px-3 py-2">
                      <span className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={outcomeTone(target, result.outcome)}>{t(outcomeKey(result.outcome))}</StatusPill>
                        {result.serotype && <span className="text-xs font-semibold">{result.serotype}</span>}
                        {result.ct_value && <span className="text-xs text-ink-2 tabular-nums">Ct {result.ct_value}</span>}
                        {canManage && !lockable && (
                          <CardMenu
                            items={[
                              {
                                label: t("pcr.detail.voidResult"),
                                onSelect: () => {
                                  onVoidResult(result.id);
                                },
                              },
                            ]}
                          />
                        )}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {batch.results.length === 0 && <p className="m-0 mt-3 text-sm text-ink-2">{t("pcr.detail.noResults")}</p>}
      {history.length > 0 && (
        <ul className="m-0 mt-4 flex list-none flex-col gap-1 border-t border-line p-0 pt-3 text-xs text-ink-2">
          {history.map((row) => (
            <li key={row.id}>
              <span className="line-through">
                {row.sample_code} · {t(targetKey(row.target))} · {t(outcomeKey(row.outcome))}
              </span>{" "}
              <strong>{t(row.voided ? "pcr.detail.voidedResult" : "pcr.detail.replaced")}</strong> ·{" "}
              {row.author_name} · {formatDateTime(row.created_at)}
              {row.void_reason && <> · {t("pcr.detail.reasonLabel", { reason: row.void_reason })}</>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ReportCard({ batch, canManage }: { batch: PcrDetail; canManage: boolean }) {
  const { t } = useTranslation();
  const formatDateTime = useFormatDateTime();
  const download = usePcrDownload();
  const files = usePcrUpload();
  const command = usePcrCommand(batch);
  const [file, setFile] = useState<File>();
  const [error, setError] = useState<string>();
  const canUpload =
    canManage && ["received_by_lab", "results_received", "closed"].includes(batch.status);
  return (
    <Card title={t("pcr.detail.report")}>
      <div className="flex flex-col gap-3">
        {batch.reports.length === 0 && <p className="m-0 text-sm text-ink-2">{t("pcr.detail.noReport")}</p>}
        {batch.reports.map((report, index) => (
          <div key={report.id} className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm">
              {report.author_name} · {formatDateTime(report.created_at)}
            </span>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<Download aria-hidden="true" />}
              onClick={() => {
                void download(
                  { kind: "report", id: batch.id, report_id: report.id },
                  `${batch.code}-informe-${String(index + 1)}.pdf`,
                );
              }}
            >
              {t("pcr.detail.downloadReport")}
            </Button>
          </div>
        ))}
        {canUpload && (
          <div className="flex flex-wrap items-end gap-3 border-t border-line pt-3">
            <FilePicker
              id="pcr-report"
              label={t("pcr.detail.uploadReport")}
              accept={["application/pdf"]}
              typeError={t("pcr.file.typePdf")}
              file={file}
              error={error ?? command.error}
              onChange={(next, problem) => {
                setFile(next);
                setError(problem);
              }}
            />
            <Button
              variant="secondary"
              leadingIcon={<FileUp aria-hidden="true" />}
              aria-disabled={!file || undefined}
              loading={files.isBusy || command.isPending}
              onClick={() => {
                if (!file) return;
                files.upload(file).then(
                  (uploadId) => {
                    command.run({ kind: "report", upload_id: uploadId });
                    setFile(undefined);
                  },
                  () => {
                    setError(t("pcr.error.pcr_file_not_ready"));
                  },
                );
              }}
            >
              {t("pcr.detail.uploadReport")}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function History({ batch }: { batch: PcrDetail }) {
  const { t } = useTranslation();
  const formatDateTime = useFormatDateTime();
  const download = usePcrDownload();
  return (
    <Card title={t("pcr.detail.history")}>
      <ol className="m-0 flex list-none flex-col gap-4 p-0">
        {[...batch.events].reverse().map((event) => (
          <li key={event.id} className={cn("flex gap-3", event.undone && "opacity-60")}>
            <span className="mt-1 grid size-7 flex-none place-items-center rounded-full bg-tint text-action-strong">
              {event.kind === "ship" ? <Send aria-hidden="true" className="size-3.5" /> : <Check aria-hidden="true" className="size-3.5" />}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5 text-sm">
              <span className={cn("font-semibold", event.undone && "line-through")}>
                {t(`pcr.event.${event.kind}`)}
                {event.undone && <span className="ml-2 text-xs font-semibold text-warning no-underline">{t("pcr.detail.undone")}</span>}
              </span>
              <span className="text-xs text-ink-2">
                {event.author_name} · {formatDateTime(event.occurred_at)}
              </span>
              {event.tracking_number && (
                <span className="text-xs">{t("pcr.detail.tracking", { number: event.tracking_number })}</span>
              )}
              {event.carrier && <span className="text-xs">{t("pcr.detail.carrier", { name: event.carrier })}</span>}
              {event.reason && <span className="text-xs">{t("pcr.detail.reasonLabel", { reason: event.reason })}</span>}
              {event.has_evidence && (
                <button
                  type="button"
                  className="w-fit text-xs font-semibold text-action-strong underline"
                  onClick={() => {
                    const extension = event.evidence_type === "application/pdf" ? "pdf" : event.evidence_type === "image/png" ? "png" : "jpg";
                    void download({ kind: "evidence", id: batch.id, event_id: event.id }, `${batch.code}-envio.${extension}`);
                  }}
                >
                  {t("pcr.detail.downloadEvidence")}
                </button>
              )}
            </div>
          </li>
        ))}
        <li className="flex gap-3">
          <span className="mt-1 grid size-7 flex-none place-items-center rounded-full bg-surface-muted text-ink-2">
            <Check aria-hidden="true" className="size-3.5" />
          </span>
          <div className="flex flex-col gap-0.5 text-sm">
            <span className="font-semibold">{t("pcr.status.preparing")}</span>
            <span className="text-xs text-ink-2">
              {batch.author_name} · {formatDateTime(batch.created_at)}
            </span>
          </div>
        </li>
      </ol>
    </Card>
  );
}
