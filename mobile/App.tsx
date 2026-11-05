import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppRoot } from "./src/app/AppRoot.tsx";

/**
 * Android 16 draws edge-to-edge: the app sits behind the status bar and the gesture bar. The
 * safe-area insets (read by the headers and footers) keep content clear of both (proven in the #1 spike).
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <AppRoot />
    </SafeAreaProvider>
  );
}
