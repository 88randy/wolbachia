import { useNavigation } from "../navigation/NavigationProvider.tsx";
import { StylePreview } from "../ui/preview/StylePreview.tsx";

/** Routed only when the existing build-time developer-tools flag is enabled. */
export function StylePreviewScreen() {
  const { goBack } = useNavigation();
  return <StylePreview onBack={goBack} />;
}
