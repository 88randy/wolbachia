import { Link, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { ApiError } from "@wolbachia/api-client";
import { Card } from "../ui/Card";
import { CardSkeleton } from "../ui/CardSkeleton";
import { ErrorState } from "../ui/ErrorState";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { NotFoundState } from "../states/NotFoundState";
import { useCan } from "../session/use-can";
import { useDocumentTitle } from "../shell/use-document-title";
import { useRetryWindow } from "../quadrants/geography/use-retry-window";
import { inventoryRecordOptions } from "./inventory-query";
import { InventoryEditGate } from "./InventoryEditGate";
import { InventoryFormFeedback } from "./InventoryFormFeedback";
import { useInventoryContext, useInventoryCode } from "./use-inventory-context";
import { useInventoryWrite } from "./use-inventory-write";
import { LotSafetySummary } from "./lots/LotSafetySummary";
import { LocationStock } from "./locations/LocationStock";
import type { InventoryKind, InventoryRecord as RecordValue } from "./inventory-links";
import page from "../styles/page.module.css";
import styles from "./inventory.module.css";
import { InventoryDraftMemory } from "./use-inventory-draft";
import { InventoryFacts } from "./InventoryFacts";
import { InventoryContextNotice } from "./InventoryContextNotice";
const updatePermission = {
  supplies: "supply_type.update",
  lots: "lot.update",
  locations: "location.update",
} as const;
const lists = {
  supplies: "/inventory/supplies",
  lots: "/inventory/lots",
  locations: "/inventory/locations",
} as const;
function useDraftRetirement(options: { kind: InventoryKind; code: string; denied: boolean }) {
  const memory = useContext(InventoryDraftMemory);
  const { kind, code, denied } = options;
  useEffect(() => {
    if (denied)
      memory.current = Object.fromEntries(
        Object.entries(memory.current).filter(
          ([key, draft]) => !key.startsWith(kind + ":") || draft.reviewed?.code !== code,
        ),
      );
  }, [denied, code, kind, memory]);
}
function visibleRecord(
  record: RecordValue | null | undefined,
  target: { code: string; location?: string },
) {
  if (!record || record.code !== target.code) return null;
  if (
    target.location &&
    (!("safety_location_id" in record) || record.safety_location_id !== target.location)
  )
    return null;
  return record;
}
function deniedRecord({
  query,
  record,
  editable,
}: {
  query: { error: unknown; isSuccess: boolean; isFetching: boolean; isPlaceholderData: boolean };
  record: RecordValue | null;
  editable: boolean;
}) {
  if (query.error instanceof ApiError && [403, 404].includes(query.error.status)) return true;
  return query.isSuccess && !query.isFetching && !query.isPlaceholderData && (!record || !editable);
}
function useRecord(kind: InventoryKind) {
  const code = useInventoryCode() ?? "";
  const scope = useInventoryContext();
  const query = useQuery(inventoryRecordOptions(scope, kind, code));
  const custody = kind === "lots" && scope.readContext.mode === "custody";
  const readonly = scope.readContext.mode !== "admission";
  const editable = useCan()(updatePermission[kind]) && !readonly;
  const location =
    custody && scope.readContext.mode === "custody" ? scope.readContext.location : undefined;
  const record = visibleRecord(query.data, { code, ...(location ? { location } : {}) });
  useDraftRetirement({
    kind,
    code,
    denied: !readonly && deniedRecord({ query, record, editable }),
  });
  useDocumentTitle(code);
  return { query, record, editable, custody, readonly };
}
export function InventoryRecord({ kind }: { kind: InventoryKind }) {
  const model = useRecord(kind);
  if (model.query.isPending || model.query.isPlaceholderData) return <CardSkeleton />;
  if (model.custody && (model.query.isError || !model.record))
    return (
      <InventoryContextNotice
        state="unavailable"
        onRetry={() => {
          void model.query.refetch();
        }}
      />
    );
  if (model.query.isError)
    return (
      <ErrorState
        onRetry={() => {
          void model.query.refetch();
        }}
      />
    );
  if (!model.record) return <NotFoundState />;
  return <RecordContent kind={kind} model={model} record={model.record} />;
}
interface ContentProps {
  kind: InventoryKind;
  model: ReturnType<typeof useRecord>;
  record: RecordValue;
}
function RecordBack({ kind }: { kind: InventoryKind }) {
  const { t } = useTranslation();
  const search = Object.fromEntries(
    Object.entries(useSearch({ strict: false })).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  return (
    <Link to={lists[kind]} search={search}>
      {t("inventory.action.back")}
    </Link>
  );
}
function RecordEditor({ kind, model, record, onSaved }: ContentProps & { onSaved: () => void }) {
  if (!model.editable) return <InventoryFacts record={record} />;
  return (
    <InventoryEditGate
      kind={kind}
      record={record}
      isVerifying={model.query.isFetching}
      onSaved={onSaved}
    />
  );
}
function RecordContent(props: ContentProps) {
  const { t } = useTranslation();
  const [saved, setSaved] = useState(false);
  const refresh = () => {
    void props.model.query.refetch();
  };
  const accepted = () => {
    setSaved(true);
  };
  return (
    <section className={[page.page, styles.content].join(" ")}>
      <Card title={props.record.code} headingLevel={1}>
        <div className={styles.actions}>
          <RecordBack kind={props.kind} />
          <RefreshAction refresh={refresh} />
        </div>
        <p role="status">{saved ? t("inventory.state.saved") : ""}</p>
        <RecordFacts record={props.record} />
        <RecordEditor {...props} onSaved={accepted} />
        {!props.model.readonly && (
          <RetireSupply
            record={props.record}
            verifying={props.model.query.isFetching}
            refresh={refresh}
          />
        )}
      </Card>
    </section>
  );
}
function RefreshAction({ refresh }: { refresh: () => void }) {
  const { t } = useTranslation();
  return (
    <Button variant="secondary" onClick={refresh}>
      {t("inventory.action.refresh")}
    </Button>
  );
}
function RecordFacts({ record }: { record: RecordValue }) {
  return (
    <>
      {"supply_version" in record && <LotSafetySummary lot={record} />}
      {"label" in record && <p>{record.label}</p>}
      {"name" in record && <p>{record.name}</p>}
      {"geometry" in record && <LocationStock location={record} />}
    </>
  );
}
interface RetireConfirmProps {
  record: Schemas["Supply"];
  write: ReturnType<typeof useInventoryWrite>;
  disabled: boolean;
}
function retirementSnapshot(record: Schemas["Supply"]) {
  return { id: record.id, revision: record.revision, label: record.label };
}
function useRetirementReview({ record, write }: Pick<RetireConfirmProps, "record" | "write">) {
  const [reviewed, setReviewed] = useState(() => retirementSnapshot(record));
  const open = () => {
    setReviewed(retirementSnapshot(record));
  };
  const retire = () => {
    void write.send({
      kind: "deactivate",
      id: reviewed.id,
      body: { expected_revision: reviewed.revision },
    });
  };
  return { reviewed, open, retire };
}
function RetireConfirm(props: RetireConfirmProps) {
  const { t } = useTranslation();
  const review = useRetirementReview(props);
  const consequence = [
    t("inventory.state.deactivate"),
    review.reviewed.label,
    t("inventory.field.revision") + ": " + String(review.reviewed.revision),
  ].join(" · ");
  const trigger = (
    <Button variant="secondary" disabled={props.disabled} onClick={review.open}>
      {t("inventory.action.deactivate")}
    </Button>
  );
  return (
    <ConfirmDialog
      trigger={trigger}
      title={t("inventory.action.deactivate")}
      consequence={consequence}
      actionLabel={t("inventory.action.deactivate")}
      onConfirm={review.retire}
    />
  );
}
interface RetirementProps {
  record: RecordValue;
  verifying: boolean;
  refresh: () => void;
}
function useRetirement(record: RecordValue) {
  const allowed = useCan()("supply_type.deactivate");
  const write = useInventoryWrite(undefined, { kind: "supplies", code: record.code });
  const { failure, clearFailure } = write;
  const cooling = useRetryWindow(failure?.retryAt ?? 0);
  const retired = "is_active" in record && !record.is_active;
  useEffect(() => {
    if (retired && failure?.uncertain) clearFailure();
  }, [retired, failure, clearFailure]);
  const blocked =
    write.isBusy || cooling || failure?.conflict === true || failure?.uncertain === true;
  return { allowed, write, retired, blocked };
}
function RetireSupply({ record, verifying, refresh }: RetirementProps) {
  const { t } = useTranslation();
  const { allowed, write, retired, blocked } = useRetirement(record);
  if (!("is_active" in record) || !allowed) return null;
  return (
    <>
      <RetireConfirm record={record} write={write} disabled={retired || verifying || blocked} />
      {retired && <p>{t("inventory.status.inactive")}</p>}
      <InventoryFormFeedback
        failure={write.failure}
        invalid={false}
        disabled={verifying}
        onReview={write.clearFailure}
        onReconcile={refresh}
      />
    </>
  );
}
