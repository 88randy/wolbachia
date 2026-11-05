import * as SecureStore from "expo-secure-store";

import type { SecretStorage } from "./secret-storage.ts";

/** No user-auth binding: sync must read credentials while the UI is locked. */
export const nativeSecrets: SecretStorage = {
  get: (key) => SecureStore.getItemAsync(key, { requireAuthentication: false }),
  set: (key, value) => SecureStore.setItemAsync(key, value, { requireAuthentication: false }),
};
