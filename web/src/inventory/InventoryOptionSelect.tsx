import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { Select } from "../forms/Select";
import { SearchField } from "../forms/SearchField";
import { Button } from "../ui/Button";
import { ErrorState } from "../ui/ErrorState";
import { useInventoryContext } from "./use-inventory-context";
import { inventoryOptionOptions } from "./inventory-options";
import type { OptionRequest } from "./inventory-options";
import styles from "./inventory.module.css";
type Row =
  | Schemas["Center"]
  | Schemas["Supply"]
  | Schemas["OwnerOption"]
  | Schemas["PlacementOption"]
  | Schemas["ProtocolTypeOption"];
interface Props {
  id: string;
  label: string;
  request: OptionRequest;
  value: string;
  currentLabel?: string;
  disabled?: boolean;
  required?: boolean;
  onChange: (value: string) => void;
  onChoice?: (choice: { value: string; label: string }) => void;
}
function optionOf(row: Row, empty: string) {
  if ("membership_id" in row) return { value: row.membership_id, label: row.label };
  if ("incident_type_version_id" in row)
    return { value: row.incident_type_version_id, label: row.label };
  if ("id" in row) return { value: row.id, label: "label" in row ? row.label : row.name };
  return {
    value: "location_id" in row ? (row.location_id ?? "none") : (row.quadrant_id ?? "none"),
    label: row.code ?? empty,
  };
}
function useChoice(props: Props) {
  const { t } = useTranslation();
  const { page, setPage, search, find } = useOptionSearch();
  const [selectedLabel, setSelectedLabel] = useState("");
  const scope = useInventoryContext();
  const query = useQuery({
    ...inventoryOptionOptions(scope, props.request, { page, search }),
    refetchOnMount: false,
  });
  const rows = query.isPlaceholderData ? [] : (query.data?.results ?? []);
  const empty = t(
    props.request.action === "location.create"
      ? "inventory.option.centerOnly"
      : "inventory.option.centerDraft",
  );
  const options = rows.map((row) => optionOf(row, empty));
  retainSelected(
    options,
    props,
    selectedLabel || props.currentLabel || t("inventory.option.selected"),
  );
  const change = (value: string) => {
    const choice = options.find((option) => option.value === value);
    setSelectedLabel(choice?.label ?? "");
    props.onChange(value);
    if (choice) props.onChoice?.(choice);
  };
  return { query, options, page, setPage, search, find, change };
}
function useOptionSearch() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const find = (value: string) => {
    setSearch(value);
    setPage(1);
  };
  return { page, setPage, search, find };
}
function retainSelected(options: { value: string; label: string }[], input: Props, label: string) {
  if (input.value && !options.some((option) => option.value === input.value))
    options.unshift({ value: input.value, label });
}
type Model = ReturnType<typeof useChoice>;
function ChoiceInputs({ input, model }: { input: Props; model: Model }) {
  const { t } = useTranslation();
  const options = [{ value: "", label: t("inventory.option.choose") }, ...model.options];
  return (
    <>
      <SearchField
        id={input.id + "-search"}
        label={input.label + ": " + t("inventory.field.search")}
        value={model.search}
        disabled={input.disabled}
        onChange={(event) => {
          model.find(event.target.value);
        }}
      />
      <Select
        id={input.id}
        label={input.label}
        required={input.required}
        value={input.value}
        disabled={input.disabled || model.query.isFetching}
        options={options}
        onChange={(event) => {
          model.change(event.target.value);
        }}
      />
    </>
  );
}
function ChoicePaging({ input, model }: { input: Props; model: Model }) {
  const { t } = useTranslation();
  const busy = input.disabled || model.query.isFetching;
  return (
    <div className={styles.actions}>
      <Button
        variant="ghost"
        disabled={busy || model.page === 1}
        onClick={() => {
          model.setPage(model.page - 1);
        }}
      >
        {t("inventory.option.previous")}
      </Button>
      <Button
        variant="ghost"
        disabled={busy || !model.query.data?.next}
        onClick={() => {
          model.setPage(model.page + 1);
        }}
      >
        {t("inventory.option.next")}
      </Button>
    </div>
  );
}
/** A paginated chooser composed from existing controls; obsolete target pages never qualify. */
export function InventoryOptionSelect(props: Props) {
  const model = useChoice(props);
  return (
    <div className={styles.options} aria-busy={model.query.isFetching}>
      <ChoiceInputs input={props} model={model} />
      {model.query.isError && (
        <ErrorState
          onRetry={() => {
            void model.query.refetch();
          }}
        />
      )}
      <ChoicePaging input={props} model={model} />
    </div>
  );
}
