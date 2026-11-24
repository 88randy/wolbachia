import { useTranslation } from "react-i18next";
import styles from "./annotation-help.module.css";

const SHORTCUTS = [
  "select",
  "box",
  "point",
  "pan",
  "zoom",
  "fit",
  "actualSize",
  "grid",
  "settings",
  "help",
  "add",
  "cycle",
  "move",
  "resize",
  "delete",
  "removeAtPointer",
  "undo",
  "redo",
] as const;
export function AnnotationShortcutTable() {
  const { t } = useTranslation();
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
        {SHORTCUTS.map((action) => (
          <tr key={action}>
            <th scope="row">{t(`labAnnotation.shortcuts.${action}`)}</th>
            <td>
              <kbd>{t(`labAnnotation.shortcuts.${action}Key`)}</kbd>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
