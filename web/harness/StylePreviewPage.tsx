import { PreviewDashboard } from "./PreviewDashboard";
import { PreviewComponents } from "./PreviewComponents";
import { useOpenCommandPalette, useOpenShortcutsHelp } from "../src/shell/command-context";
import styles from "./StylePreviewPage.module.css";
export function StylePreviewPage() {
  const openPalette = useOpenCommandPalette();
  const openHelp = useOpenShortcutsHelp();
  return (
    <div className={styles.page}>
      <PreviewDashboard />
      <PreviewComponents onOpenPalette={openPalette} onOpenHelp={openHelp} />
    </div>
  );
}
