import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchField } from "../../forms/SearchField";
import { toLabelRecord } from "../../labels/label-records";
import type { LabelSource } from "../../labels/label-records";
import { useLabelText } from "../../labels/use-label-text";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { EmptyState } from "../../ui/EmptyState";
import { ErrorState } from "../../ui/ErrorState";
import { CardSkeleton } from "../../ui/CardSkeleton";
import type { useLabelPicker } from "./use-label-picker";
import { labelPageSize } from "./label-query";

type Model = ReturnType<typeof useLabelPicker>;

function PickerRow({ model, source }: { model: Model; source: LabelSource }) {
  const { t } = useTranslation();
  const record = toLabelRecord(source, useLabelText());
  const id = `label-row-${source.row.id}`;
  return (
    <li className="flex items-center gap-3 border-b border-line py-2 last:border-0">
      <Checkbox
        id={id}
        checked={model.selected.some((entry) => entry.row.id === source.row.id)}
        aria-label={t("inventory.labels.rowSelect", { code: record.code })}
        onCheckedChange={() => {
          model.toggle(source);
        }}
      />
      <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col">
        <span className="text-sm font-semibold whitespace-nowrap text-ink">{record.code}</span>
        {record.lines.length > 0 && (
          <span className="text-xs text-ink-3">{record.lines.join(" · ")}</span>
        )}
      </label>
    </li>
  );
}

function PickerRows({ model }: { model: Model }) {
  return (
    <ul className="m-0 flex max-h-[28rem] list-none flex-col overflow-y-auto p-0">
      {model.items.map((source) => (
        <PickerRow key={source.row.id} model={model} source={source} />
      ))}
    </ul>
  );
}

function PickerBody({ model }: { model: Model }) {
  const { t } = useTranslation();
  if (model.query.isPending) return <CardSkeleton />;
  if (model.query.isError)
    return (
      <ErrorState
        message={t("inventory.labels.loadError")}
        onRetry={() => {
          void model.query.refetch();
        }}
      />
    );
  if (model.items.length === 0)
    return <EmptyState kind="noResults" message={t("inventory.labels.empty")} />;
  return <PickerRows model={model} />;
}

function PickerToolbar({ model }: { model: Model }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" onClick={model.tickVisible}>
        {t("inventory.labels.selectAll")}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={model.selected.length === 0}
        onClick={model.clear}
      >
        {t("inventory.labels.clearSelection")}
      </Button>
      <span role="status" className="text-sm text-ink-2">
        {t("inventory.labels.selected", { count: model.selected.length })}
      </span>
    </div>
  );
}

/** Searchable checklist of records of the chosen kind. */
export function LabelPicker({ model }: { model: Model }) {
  const { t } = useTranslation();
  return (
    <Card title={t(`inventory.labels.kind.${model.kind}`)}>
      <div className="flex flex-col gap-3">
        <SearchField
          id="label-search"
          label={t("inventory.labels.search")}
          value={model.search}
          onChange={(event) => {
            model.setSearch(event.target.value);
          }}
        />
        <PickerToolbar model={model} />
        <PickerBody model={model} />
        {model.total > labelPageSize(model.kind) && (
          <p className="m-0 text-xs text-ink-3">
            {t("inventory.labels.truncated", { count: labelPageSize(model.kind) })}
          </p>
        )}
      </div>
    </Card>
  );
}
