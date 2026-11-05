import * as Tabs from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import styles from "./ui.module.css";

interface FolderTabsProps {
  label: string;
  items: readonly { value: string; label: string; content: ReactNode }[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}
export function FolderTabs({ label, items, defaultValue, value, onValueChange }: FolderTabsProps) {
  return (
    <Tabs.Root
      defaultValue={defaultValue ?? items[0]?.value}
      value={value}
      onValueChange={onValueChange}
    >
      <Tabs.List className={styles.tabs} aria-label={label}>
        {items.map((item) => (
          <Tabs.Trigger className={styles.tab} key={item.value} value={item.value}>
            {item.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {items.map((item) => (
        <Tabs.Content className={styles.tabPanel} key={item.value} value={item.value}>
          {item.content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
