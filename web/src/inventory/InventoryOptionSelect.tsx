import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import type { Schemas } from "@wolbachia/api-client";
import { useCan } from "../session/use-can";
import { Combobox } from "../ui/Combobox";
import { ErrorState } from "../ui/ErrorState";
import { useInventoryContext } from "./use-inventory-context";
import { inventoryOptionOptions, optionReady } from "./inventory-options";
import type { OptionRequest } from "./inventory-options";
import { useLocationNames } from "./use-location-names";
import styles from "./inventory.module.css";
type Row =
  | Schemas["CenterAdmin"]
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
  /** Plain words for what to choose first, shown while this list has nothing to ask yet. */
  waitingFor?: MessageKey;
  /** What to say, and where to go, when the list is legitimately empty. */
  empty?: { message: MessageKey; action?: { label: MessageKey; to: LinkProps["to"] } };
  /** Pick the only choice automatically (a single center, a single warehouse). */
  autoPickOnly?: boolean;
  onChange: (value: string) => void;
  onChoice?: (choice: { value: string; label: string }) => void;
}
type Names = (id: string) => string | undefined;
function optionOf(row: Row, empty: string, names: Names) {
  if ("membership_id" in row) return { value: row.membership_id, label: row.label };
  if ("incident_type_version_id" in row)
    return { value: row.incident_type_version_id, label: row.label };
  if ("id" in row) return { value: row.id, label: "label" in row ? row.label : row.name };
  if ("location_id" in row && row.location_id)
    return {
      value: row.location_id,
      label: names(row.location_id) ?? row.code ?? empty,
      detail: row.code ?? undefined,
    };
  return { value: row.quadrant_id ?? "none", label: row.code ?? empty };
}
function useChoice(props: Props) {
  const { t } = useTranslation();
  const [search, find] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("");
  const scope = useInventoryContext();
  const names = useLocationNames();
  const query = useQuery({
    ...inventoryOptionOptions(scope, props.request, { page: 1, search }),
    refetchOnMount: false,
  });
  const rows = query.isPlaceholderData ? [] : (query.data?.results ?? []);
  const empty = t(
    props.request.action === "location.create"
      ? "inventory.option.centerOnly"
      : "inventory.option.centerDraft",
  );
  const options: { value: string; label: string; detail?: string }[] = rows.map((row) =>
    optionOf(row, empty, names),
  );
  if (props.value && !options.some((option) => option.value === props.value))
    options.unshift({
      value: props.value,
      label: selectedLabel || props.currentLabel || t("inventory.option.selected"),
    });
  const change = (value: string) => {
    const choice = options.find((option) => option.value === value);
    setSelectedLabel(choice?.label ?? "");
    props.onChange(value);
    if (choice) props.onChoice?.(choice);
  };
  const only = options.length === 1 ? options[0] : undefined;
  const pickOnly = props.autoPickOnly && search === "" && !props.value && !props.disabled;
  useEffect(() => {
    if (pickOnly && only) change(only.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when the single choice appears
  }, [pickOnly, only?.value]);
  return { query, options, find, change };
}
type Model = ReturnType<typeof useChoice>;
function createPermission(to: LinkProps["to"]) {
  return to === "/inventory/supplies" ? "supply_type.create" : "location.create";
}
function EmptyMessage({ input }: { input: Props }) {
  const { t } = useTranslation();
  const can = useCan();
  if (!input.empty) return undefined;
  return (
    <span className="flex flex-col items-center gap-1 px-2 py-1 text-center">
      <span>{t(input.empty.message)}</span>
      {input.empty.action && can(createPermission(input.empty.action.to)) && (
        <Link to={input.empty.action.to} className="font-semibold">
          {t(input.empty.action.label)}
        </Link>
      )}
    </span>
  );
}
function ChoiceInputs({ input, model }: { input: Props; model: Model }) {
  const { t } = useTranslation();
  const isWaiting = !optionReady(input.request) && input.waitingFor !== undefined;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={input.id} className="text-xs font-bold text-ink">
        {input.label}
      </label>
      <Combobox
        id={input.id}
        value={input.value}
        options={model.options}
        placeholder={t(
          isWaiting && input.waitingFor ? input.waitingFor : "inventory.option.choose",
        )}
        selectedLabel={input.currentLabel}
        disabled={input.disabled || isWaiting}
        isLoading={model.query.isFetching && model.options.length === 0}
        emptyMessage={EmptyMessage({ input })}
        onSearch={model.find}
        onValueChange={model.change}
      />
    </div>
  );
}
/** One searchable picker that always shows names; an empty list says what to do next. */
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
    </div>
  );
}
