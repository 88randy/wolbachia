/* eslint jsx-a11y/no-noninteractive-tabindex: ["error", {"roles": ["region"]}] -- Named scrollable component matrix supports keyboard scrolling. */
import { useTranslation } from "react-i18next";
import type { PreviewButtonVariant } from "./preview-button-options";
import { BUTTON_SIZES, BUTTON_STATES } from "./preview-button-options";
import { PreviewButtonStateRow } from "./PreviewButtonStateRow";
import styles from "./PreviewComponents.module.css";
export function PreviewButtonMatrix({ entry }: { entry: PreviewButtonVariant }) {
  const { t } = useTranslation();
  const label = t(`refresh.buttons.${entry.label}`);
  return (
    <div className={styles.buttonMatrixScroll} role="region" tabIndex={0} aria-label={label}>
      <table className={styles.buttonMatrix}>
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">{t("refresh.buttons.state")}</th>
            {BUTTON_SIZES.map((size) => (
              <th key={size.value} scope="col">
                {t(`refresh.buttons.${size.label}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BUTTON_STATES.map((state) => (
            <PreviewButtonStateRow key={state} state={state} entry={entry} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
