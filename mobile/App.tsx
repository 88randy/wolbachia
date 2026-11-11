import "./global.css";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppRoot } from "./src/app/AppRoot.tsx";

/**
 * Android 16 draws edge-to-edge: the app sits behind the status bar and the gesture bar. The
 * safe-area insets (read by the headers and footers) keep content clear of both (proven in the #1 spike).
 * One status bar for the whole app, mounted once here: dark icons on the light background. Never
 * add another instance or call setStatusBarStyle: swapping instances made the bar flicker.
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppRoot />
    </SafeAreaProvider>
  );
}
