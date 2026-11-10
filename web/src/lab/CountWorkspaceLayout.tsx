import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CountQueue } from "./CountQueue";
import styles from "./lab.module.css";

type CountWorkspaceLayoutProps = ComponentProps<typeof CountQueue> & {
  isLocked: boolean;
  children: ReactNode;
};

export function CountWorkspaceLayout({ isLocked, children, ...queue }: CountWorkspaceLayoutProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.workspace}>
      <fieldset className={styles.queue} disabled={isLocked}>
        <legend>{t("lab.queue.title")}</legend>
        <CountQueue {...queue} />
      </fieldset>
      {children}
    </div>
  );
}
