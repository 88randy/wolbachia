import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Ellipsis } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import styles from "./ui.module.css";

interface CardMenuProps {
  label?: string;
  items: readonly { label: string; onSelect: () => void; disabled?: boolean }[];
}
export function CardMenu({ label, items }: CardMenuProps) {
  const { t } = useTranslation();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="sm" aria-label={label ?? t("ui.actions.more")}>
          <Ellipsis aria-hidden="true" strokeWidth={1.5} />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.menu} align="end" sideOffset={4}>
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.label}
              className={styles.menuItem}
              onSelect={item.onSelect}
              disabled={item.disabled}
            >
              {item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
