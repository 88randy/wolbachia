import type { ReactNode } from "react";
import { LanguageSwitch } from "../shell/LanguageSwitch";
import { useDocumentTitle } from "../shell/use-document-title";
import styles from "./auth.module.css";
import { AuthBrandPanel } from "./AuthBrandPanel";

interface AuthLayoutProps {
  /** Page title: the card heading and the document title. */
  title: string;
  children: ReactNode;
}

/** Frame of the pages that need no session: brand panel, a card with the title and the language switch. */
export function AuthLayout({ title, children }: AuthLayoutProps) {
  useDocumentTitle(title);
  return (
    <div className={styles.layout}>
      <AuthBrandPanel />
      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h1 className={styles.title}>{title}</h1>
            <LanguageSwitch className={styles.languageSwitch} />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
