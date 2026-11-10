import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { useApiClient } from "../api/ApiClientProvider";
import { SearchField } from "../forms/SearchField";
import { useSessionIdentity } from "../session/use-session-identity";
import { blocksDirectoryOptions } from "./scheduling-queries";

/** Pick blocks from a searchable list instead of typing codes. */
export function BlockPicker({
  selected,
  onChange,
  error,
}: {
  selected: readonly string[];
  onChange: (ids: string[]) => void;
  error?: string;
}) {
  const { t } = useTranslation();
  const client = useApiClient();
  const identity = useSessionIdentity();
  const [text, setText] = useState("");
  const blocks = useQuery(blocksDirectoryOptions(client, identity)).data ?? [];
  const shown = blocks.filter((block) =>
    block.code.toLowerCase().includes(text.trim().toLowerCase()),
  );
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-1 text-[13px] font-semibold text-ink">
        {t("scheduling.intervention.blocks")}
      </legend>
      <SearchField
        id="block-search"
        label={t("scheduling.intervention.blockSearch")}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
        }}
      />
      <ul className="m-0 grid max-h-48 list-none gap-1 overflow-auto rounded-xl border border-line p-2 sm:grid-cols-2">
        {shown.map((block) => (
          <li key={block.id}>
            <label className="flex min-h-8 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm hover:bg-tint">
              <Checkbox
                checked={selected.includes(block.id)}
                onCheckedChange={(checked) => {
                  onChange(
                    checked === true
                      ? [...selected, block.id]
                      : selected.filter((id) => id !== block.id),
                  );
                }}
              />
              {block.code}
            </label>
          </li>
        ))}
        {shown.length === 0 && (
          <li className="px-2 py-1 text-[13px] text-ink-2">
            {t("scheduling.intervention.noBlocks")}
          </li>
        )}
      </ul>
      <p className="m-0 text-xs text-ink-2" aria-live="polite">
        {t("scheduling.intervention.selected", { count: selected.length })}
      </p>
      {error && <p className="m-0 text-xs text-critical-fg">{error}</p>}
    </fieldset>
  );
}
