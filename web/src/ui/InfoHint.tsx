import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip } from "./Tooltip";

/** A small (i) next to a title: the place for a hint that is really needed, never a banner. */
export function InfoHint({ text }: { text: string }) {
  const { t } = useTranslation();
  return (
    <Tooltip content={text}>
      <button
        type="button"
        aria-label={`${t("table.filters.info")}: ${text}`}
        className="inline-grid size-7 flex-none place-items-center rounded-full text-ink-3 hover:bg-surface-muted hover:text-ink"
      >
        <Info aria-hidden="true" strokeWidth={1.75} className="size-4" />
      </button>
    </Tooltip>
  );
}
