import { Ellipsis } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "../ui/Button";

export interface LabRowMenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

/** The "⋯" menu of a row: rare or contextual actions. Swap for the foundation menu when it lands. */
export function LabRowMenu({
  items,
  rowLabel,
}: {
  items: readonly LabRowMenuItem[];
  rowLabel: string;
}) {
  const { t } = useTranslation();
  if (items.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MenuButton label={`${t("lab.col.actions")}: ${rowLabel}`} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item) => (
          <DropdownMenuItem key={item.label} disabled={item.disabled} onSelect={item.onSelect}>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MenuButton({ label, ...props }: { label: string }) {
  return (
    <Button
      {...props}
      size="sm"
      variant="ghost"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      <Ellipsis aria-hidden="true" />
    </Button>
  );
}
