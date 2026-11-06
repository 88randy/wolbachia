import { useTranslation } from "react-i18next";
import { PreviewButtons } from "./PreviewButtons";
import { PreviewForms } from "./PreviewForms";
import { PreviewFeedback } from "./PreviewFeedback";
import { PreviewOverlays } from "./PreviewOverlays";
import { PreviewStates } from "./PreviewStates";
import { PreviewTokens } from "./PreviewTokens";
import styles from "./PreviewComponents.module.css";
interface PreviewComponentsProps {
  onOpenPalette: () => void;
  onOpenHelp: () => void;
}
export function PreviewComponents(props: PreviewComponentsProps) {
  const { t } = useTranslation();
  return (
    <section className={styles.gallery} aria-labelledby="preview-components-title">
      <h2 id="preview-components-title">{t("refresh.preview.components")}</h2>
      <div className={styles.grid}>
        <PreviewButtons />
        <PreviewForms />
        <PreviewFeedback />
        <PreviewOverlays {...props} />
      </div>
      <PreviewStates />
      <PreviewTokens />
    </section>
  );
}
