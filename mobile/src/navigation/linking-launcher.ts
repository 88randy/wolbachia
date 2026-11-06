import type { NavigationLauncher } from "./navigation-service.ts";
interface LinkingPort {
  canOpenURL(uri: string): Promise<boolean>;
  openURL(uri: string): Promise<unknown>;
}
/** The platform adapter is testable without importing React Native; Device Owner rejection stays a denied outcome. */
export function createLinkingLauncher(linking: LinkingPort): NavigationLauncher {
  return {
    async launch(uri) {
      try {
        if (!(await linking.canOpenURL(uri))) return "no_handler";
        await linking.openURL(uri);
        return "launched";
      } catch {
        return "denied";
      }
    },
  };
}
