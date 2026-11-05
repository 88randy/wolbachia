import { AppShell } from "../src/shell/AppShell";
import { ToastProvider } from "../src/ui/ToastProvider";
import { StylePreviewPage } from "./StylePreviewPage";
export function PreviewShell() {
  return (
    <ToastProvider>
      <AppShell>
        <StylePreviewPage />
      </AppShell>
    </ToastProvider>
  );
}
