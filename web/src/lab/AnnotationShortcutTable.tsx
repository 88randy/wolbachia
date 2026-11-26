import { useTranslation } from "react-i18next";
import styles from "./annotation-help.module.css";

const SHORTCUTS = [
  "select",
  "box",
  "point",
  "pan",
  "zoom",
  "grid",
  "fit",
  "actualSize",
  "settings",
  "undo",
  "redo",
  "holdPan",
  "rightPan",
  "delete",
  "removeAtPointer",
  "closePanel",
] as const;
/** Keyboard-only extras listed in the full shortcuts dialog, not in the compact settings panel. */
const EXTENDED_SHORTCUTS = ["help", "add", "cycle", "move", "resize"] as const;
export function AnnotationShortcutTable({ isCompact = false }: { isCompact?: boolean }) {
  const { t } = useTranslation();
  const modifier = /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? "⌘" : "Ctrl";
  return (
    <table className={styles.shortcuts}>
      <caption className={styles.visuallyHidden}>{t("labAnnotation.shortcuts.title")}</caption>
      <thead>
        <tr>
          <th scope="col">{t("labAnnotation.shortcuts.action")}</th>
          <th scope="col">{t("labAnnotation.shortcuts.key")}</th>
        </tr>
      </thead>
      <tbody>
        {(isCompact ? SHORTCUTS : [...SHORTCUTS, ...EXTENDED_SHORTCUTS]).map((action) => (
          <tr key={action}>
            <th scope="row">{t(`labAnnotation.shortcuts.${action}`)}</th>
            <td>
              <kbd>{t(`labAnnotation.shortcuts.${action}Key`).replace("Ctrl", modifier)}</kbd>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
