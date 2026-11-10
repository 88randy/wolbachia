import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { TableController } from "../../data-table/table-types";
import type { ToolbarSelect } from "./ListToolbar";

/** Status quick filter: one segmented control, the selected segment clearly filled. */
export function SegmentedFilter({
  controller,
  segments,
}: {
  controller: TableController;
  segments: ToolbarSelect;
}) {
  const { t } = useTranslation();
  const current = controller.state.filters[segments.key] ?? "";
  const options = [{ value: "", label: t("regulatory.common.all") }, ...segments.options];
  return (
    <div
      role="group"
      aria-label={segments.label}
      className="inline-flex flex-wrap rounded-lg border border-line-strong bg-surface p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={current === option.value}
          onClick={() => {
            controller.setFilter(segments.key, option.value === "" ? undefined : option.value);
          }}
          className={cn(
            "min-h-8 rounded-md px-3 text-[13px] font-semibold",
            current === option.value ? "bg-action text-on-action" : "text-ink-2 hover:bg-tint",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
