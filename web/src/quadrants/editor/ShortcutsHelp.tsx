import { Keyboard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Kbd } from "@/components/ui/kbd";
import { SHORTCUT_ROWS } from "./editor-shortcuts";

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Small "Atajos" popover; the ? key opens it. */
export function ShortcutsHelp({ isOpen, onOpenChange }: Props) {
  const { t } = useTranslation();
  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-keyshortcuts="?"
          aria-label={t("mapEditor.action.help")}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-transparent px-3 text-[13px] font-semibold text-ink hover:bg-tint hover:text-action-strong"
        >
          <Keyboard aria-hidden="true" className="size-4" />
          <span className="sr-only xl:not-sr-only">{t("mapEditor.action.help")}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <h2 className="m-0 mb-3 text-sm font-semibold text-ink">{t("mapEditor.keys.title")}</h2>
        <dl className="m-0 grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 text-[13px]">
          {SHORTCUT_ROWS.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-ink-2">{t(row.label)}</dt>
              <dd className="m-0 text-right">
                <Kbd>{row.keys}</Kbd>
              </dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
