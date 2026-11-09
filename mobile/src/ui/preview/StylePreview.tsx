import { useState } from "react";

import { ThemeProvider, useTheme } from "../../theme/ThemeProvider.tsx";
import { PreviewContent } from "./PreviewContent.tsx";

/** Real shared components with synthetic examples only; no services, API or saved preferences. */
export function StylePreview({ onBack }: { readonly onBack: () => void }) {
  const { scheme } = useTheme();
  const [previewScheme, setPreviewScheme] = useState(scheme);
  return (
    <ThemeProvider scheme={previewScheme}>
      <PreviewContent
        scheme={previewScheme}
        onBack={onBack}
        onToggleScheme={() => {
          setPreviewScheme((previous) => (previous === "light" ? "dark" : "light"));
        }}
      />
    </ThemeProvider>
  );
}
