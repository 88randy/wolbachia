import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchField } from "../../forms/SearchField";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { EmptyState } from "../../ui/EmptyState";
import { ErrorState } from "../../ui/ErrorState";
import { CardSkeleton } from "../../ui/CardSkeleton";
import type { useLabelSheet } from "./use-label-sheet";
import { LABEL_PAGE_SIZE } from "./label-query";
import styles from "./labels.module.css";

type Model = ReturnType<typeof useLabelSheet>;

function PickerRows({ model }: { model: Model }) {
  const { t } = useTranslation();
  return (
    <ul className={styles["picker"]}>
      {model.items.map((item) => {
        const checked = model.selected.some((entry) => entry.id === item.id);
        const id = `label-row-${item.id}`;
        return (
          <li
            key={item.id}
            className="flex items-center gap-3 border-b border-line py-2 last:border-0"
          >
            <Checkbox
              id={id}
              checked={checked}
              aria-label={t("inventory.labels.rowSelect", { code: item.code })}
              onCheckedChange={() => {
                model.toggle(item);
              }}
            />
            <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col">
              <span className="text-sm font-semibold text-ink">{item.code}</span>
              {item.caption && <span className="text-xs text-ink-3">{item.caption}</span>}
            </label>
          </li>
        );
      })}
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

/** Searchable checklist of records of the chosen type. */
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
        {model.total > LABEL_PAGE_SIZE && (
          <p className="m-0 text-xs text-ink-3">
            {t("inventory.labels.truncated", { count: LABEL_PAGE_SIZE })}
          </p>
        )}
      </div>
    </Card>
  );
}
