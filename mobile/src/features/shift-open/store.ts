import { KvStore, setStatement } from "../../db/kv-store.ts";
import type { SqlExecutor, SqlStatement } from "../../db/sql.ts";
import { readText } from "../../db/sql.ts";
import { toOutboxEvent } from "../../outbox/outbox-event.ts";
import type { OutboxEvent } from "../../outbox/outbox-event.ts";
import type { ChecklistCatalog, MapPreparation, OpenShiftDraft } from "./domain.ts";

const CATALOG_KEY = "shift_open_catalog";
const MAP_KEY = "shift_open_map";
export interface StoredShift {
  readonly draft: OpenShiftDraft | null;
  readonly opening: OutboxEvent | null;
}
/** One durable slot owns both the draft and its eventual local shift. Nothing clears it in M-04. */
export class ShiftOpenStore {
  readonly #db: SqlExecutor;
  readonly #kv: KvStore;
  constructor(db: SqlExecutor) {
    this.#db = db;
    this.#kv = new KvStore(db);
  }
  async read(): Promise<StoredShift> {
    const [row] = await this.#db.query(
      "SELECT draft, opening_event_id FROM shift_open_state WHERE slot = 1",
    );
    if (!row) return { draft: null, opening: null };
    const draft = JSON.parse(readText(row, "draft")) as OpenShiftDraft;
    const [event] = await this.#db.query("SELECT * FROM outbox_event WHERE id = ?", [
      draft.openingEventId,
    ]);
    return { draft, opening: event === undefined ? null : toOutboxEvent(event) };
  }
  async createDraft(draft: OpenShiftDraft): Promise<void> {
    await this.#db.runAtomically([
      {
        sql: "INSERT OR IGNORE INTO shift_open_state(slot, draft) VALUES (1, ?)",
        params: [JSON.stringify(draft)],
      },
    ]);
  }
  async saveDraft(draft: OpenShiftDraft): Promise<void> {
    await this.#db.runAtomically([
      {
        sql: "UPDATE shift_open_state SET draft = ? WHERE slot = 1 AND opening_event_id IS NULL",
        params: [JSON.stringify(draft)],
      },
    ]);
  }
  openStatements(draft: OpenShiftDraft): readonly SqlStatement[] {
    return [
      {
        sql: "UPDATE shift_open_state SET draft = ?, opening_event_id = ? WHERE slot = 1 AND opening_event_id IS NULL",
        params: [JSON.stringify(draft), draft.openingEventId],
      },
    ];
  }
  async catalog(): Promise<ChecklistCatalog | null> {
    const value = await this.#kv.get(CATALOG_KEY);
    return value === null ? null : (JSON.parse(value) as ChecklistCatalog);
  }
  async saveCatalog(catalog: ChecklistCatalog): Promise<void> {
    await this.#db.runAtomically([setStatement(CATALOG_KEY, JSON.stringify(catalog))]);
  }
  async map(): Promise<MapPreparation | null> {
    const value = await this.#kv.get(MAP_KEY);
    return value === null ? null : (JSON.parse(value) as MapPreparation);
  }
  async saveMap(map: MapPreparation): Promise<void> {
    await this.#kv.set(MAP_KEY, JSON.stringify(map));
  }
  async rulesVersion(): Promise<string> {
    const saved = await this.#kv.get("shift_open_rules");
    return saved === null ? "" : (JSON.parse(saved) as { version: string }).version;
  }
  async saveRules(snapshot: { readonly version: string }): Promise<void> {
    await this.#kv.set("shift_open_rules", JSON.stringify(snapshot));
  }
  async lastOdometer(code: string): Promise<number | null> {
    const [row] = await this.#db.query(
      `SELECT MAX(CAST(json_extract(payload, '$.odometer_km') AS INTEGER)) AS km
      FROM outbox_event WHERE type IN ('shift.open', 'shift.close') AND
      (json_extract(payload, '$.motorcycle_code') = ? OR shift_id IN
        (SELECT shift_id FROM outbox_event WHERE type = 'shift.open' AND json_extract(payload, '$.motorcycle_code') = ?))`,
      [code.trim(), code.trim()],
    );
    return typeof row?.km === "number" ? row.km : null;
  }
}
