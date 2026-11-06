import { Linking } from "react-native";
import { createLinkingLauncher } from "./linking-launcher.ts";
/** Deployment must allowlist the chosen geo handler. Real Device Owner return is UNVERIFIED. */
export const androidNavigation = createLinkingLauncher(Linking);
