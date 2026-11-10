import { ScanEye } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface WordmarkProps {
  /** Hide the product name visually (collapsed sidebar); it stays readable for screen readers. */
  compact?: boolean;
  /** Light text for dark surfaces (login brand panel). */
  inverted?: boolean;
  /** Organization logo (data URL from the scoped endpoint); null shows the product mark. */
  logo?: string | null;
}

/** AedesVision product wordmark. An organization logo replaces the mark, never the product name. */
export function Wordmark({ compact = false, inverted = false, logo = null }: WordmarkProps) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      {logo ? (
        <img
          src={logo}
          alt=""
          className="size-9 flex-none rounded-lg bg-surface object-contain p-0.5 shadow-xs"
        />
      ) : (
        <span
          aria-hidden="true"
          className="grid size-9 flex-none place-items-center rounded-lg bg-action text-on-action shadow-xs"
        >
          <ScanEye strokeWidth={2} className="size-5" />
        </span>
      )}
      <span
        className={cn(
          "truncate text-[17px] leading-6 font-bold tracking-tight",
          inverted ? "text-on-action" : "text-ink",
          compact && "sr-only",
        )}
      >
        {t("shell.brand.name")}
      </span>
    </span>
  );
}
