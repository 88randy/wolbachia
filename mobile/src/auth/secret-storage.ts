/** Native-free boundary: secrets never enter SQLite, AsyncStorage or logs. */
export interface SecretStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}
