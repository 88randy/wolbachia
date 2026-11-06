import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import styles from "./commands.module.css";
const SHORTCUTS: readonly { key: MessageKey; description: MessageKey }[] = [
  { key: "refresh.shortcuts.commandKey", description: "refresh.commands.title" },
  { key: "refresh.shortcuts.helpKey", description: "refresh.shortcuts.title" },
  { key: "refresh.shortcuts.escapeKey", description: "common.actions.close" },
  { key: "refresh.shortcuts.arrowsKey", description: "refresh.sidebar.resize" },
];
export function ShortcutList() {
  const { t } = useTranslation();
  return (
    <dl className={styles.shortcuts}>
      {SHORTCUTS.map(({ key, description }) => (
        <div key={key}>
          <dt>
            <kbd>{t(key)}</kbd>
          </dt>
          <dd>{t(description)}</dd>
        </div>
      ))}
    </dl>
  );
}
