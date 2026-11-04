import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { MAIN_ID } from "./ids";
import styles from "./SkipLink.module.css";

/** First focusable element: lets keyboard users jump over the sidebar and the top bar. */
export function SkipLink() {
  const { t } = useTranslation();
  // A plain hash jump would change the URL the router owns, so focus the landmark directly.
  function goToMain(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    document.getElementById(MAIN_ID)?.focus();
  }
  return (
    <a className={styles.skipLink} href={`#${MAIN_ID}`} onClick={goToMain}>
      {t("shell.a11y.skipToContent")}
    </a>
  );
}
