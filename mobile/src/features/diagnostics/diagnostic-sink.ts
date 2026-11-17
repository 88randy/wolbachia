import { KV_KEYS } from "../../db/kv-store.ts";
import type { KvStore } from "../../db/kv-store.ts";
import type { DiagnosticEntry, DiagnosticSink } from "./diagnostic-log.ts";

function isEntry(value: unknown): value is DiagnosticEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as DiagnosticEntry).at === "string" &&
    typeof (value as DiagnosticEntry).line === "string"
  );
}

/** Keeps the technical lines in the phone's own key-value table (`diagnostic_log`). */
export function diagnosticSink(kv: KvStore): DiagnosticSink {
  return {
    load: async () => {
      const raw = await kv.get(KV_KEYS.diagnosticLog);
      if (raw === null) return [];
      try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
      } catch {
        return [];
      }
    },
    save: (entries) => kv.set(KV_KEYS.diagnosticLog, JSON.stringify(entries)),
  };
}
