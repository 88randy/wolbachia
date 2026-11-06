import type { ReactNode } from "react";
import { LanguageSwitch } from "../shell/LanguageSwitch";
import { useDocumentTitle } from "../shell/use-document-title";
import { Card } from "../ui/Card";
import styles from "./auth.module.css";
import { AuthBrandPanel } from "./AuthBrandPanel";
interface AuthLayoutProps {
  title: string;
  children: ReactNode;
}
/** Public forms keep their behavior inside the same shared surface as the back office. */
export function AuthLayout({ title, children }: AuthLayoutProps) {
  useDocumentTitle(title);
  return (
    <div className={styles.layout}>
      <AuthBrandPanel />
      <main className={styles.main}>
        <Card
          title={title}
          headingLevel={1}
          className={styles.card}
          actions={<LanguageSwitch className={styles.languageSwitch} />}
        >
          {children}
        </Card>
      </main>
    </div>
  );
}
