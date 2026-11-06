import { readInteger, readOptionalText, readText } from "./sql.ts";
import type { SqlExecutor, SqlRow } from "./sql.ts";
import { firstParentheses, splitDefinitions } from "./schema-sql.ts";
import { requireSchemaMatch } from "./schema-error.ts";
import type { SchemaObject, SchemaProfile } from "./schema-profile.ts";
import type { TableShape } from "./schema-table.ts";

function ordered(value: readonly unknown[]): string {
  return JSON.stringify(value.map((item) => JSON.stringify(item)).sort());
}
function compareColumns(rows: readonly SqlRow[], table: TableShape): void {
  const actual = rows.map((row) => ({
    name: readText(row, "name"),
    type: readText(row, "type"),
    notnull: readInteger(row, "notnull"),
    dflt_value: readOptionalText(row, "dflt_value"),
    pk: readInteger(row, "pk"),
  }));
  requireSchemaMatch(JSON.stringify(actual) === JSON.stringify(table.columns));
}
function compareForeignKeys(rows: readonly SqlRow[], table: TableShape): void {
  const actual = rows.map((row) => {
    requireSchemaMatch(
      row.on_update === "NO ACTION" && row.on_delete === "NO ACTION" && row.match === "NONE",
    );
    return { table: readText(row, "table"), from: readText(row, "from"), to: readText(row, "to") };
  });
  requireSchemaMatch(ordered(actual) === ordered(table.foreignKeys));
}
function indexColumns(object: SchemaObject): readonly (string | null)[] {
  return splitDefinitions(firstParentheses(object.tokens)).map((part) =>
    part.length === 1 ? (part[0] ?? null) : null,
  );
}
async function readIndexColumns(
  db: SqlExecutor,
  name: string,
): Promise<readonly (string | null)[]> {
  const rows = await db.query("SELECT seqno,name FROM pragma_index_info(?) ORDER BY seqno", [name]);
  return rows.map((row) => readOptionalText(row, "name"));
}
async function compareIndex(input: {
  db: SqlExecutor;
  row: SqlRow;
  profile: SchemaProfile;
}): Promise<{ origin: string; columns: readonly (string | null)[] } | null> {
  const { db, row, profile } = input;
  const name = readText(row, "name");
  const columns = await readIndexColumns(db, name);
  const expected = profile.objects.get(name);
  if (!expected) {
    requireSchemaMatch(
      (row.origin === "pk" || row.origin === "u") && row.unique === 1 && row.partial === 0,
    );
    return { origin: readText(row, "origin"), columns };
  }
  requireSchemaMatch(
    expected.type === "index" &&
      row.origin === "c" &&
      row.unique === Number(expected.tokens[1] === "unique") &&
      row.partial === Number(expected.tokens.includes("where")),
  );
  requireSchemaMatch(JSON.stringify(columns) === JSON.stringify(indexColumns(expected)));
  return null;
}
async function compareIndexes(input: {
  db: SqlExecutor;
  name: string;
  table: TableShape;
  profile: SchemaProfile;
}): Promise<void> {
  const rows = await input.db.query(
    'SELECT name,"unique",origin,partial FROM pragma_index_list(?)',
    [input.name],
  );
  const automatic = [];
  for (const row of rows) {
    const index = await compareIndex({ db: input.db, row, profile: input.profile });
    if (index) automatic.push(index);
  }
  requireSchemaMatch(ordered(automatic) === ordered(input.table.automaticIndexes));
  const named = [...input.profile.objects.values()].filter(
    (object) => object.type === "index" && object.table === input.name,
  );
  requireSchemaMatch(rows.length === named.length + automatic.length);
}
/** Validate actual columns/PK/defaults, foreign keys and all generated/explicit indexes. */
export async function checkSchemaMetadata(db: SqlExecutor, profile: SchemaProfile): Promise<void> {
  for (const [name, table] of profile.tables) {
    compareColumns(
      await db.query(
        'SELECT name,type,"notnull",dflt_value,pk FROM pragma_table_info(?) ORDER BY cid',
        [name],
      ),
      table,
    );
    compareForeignKeys(await db.query("SELECT * FROM pragma_foreign_key_list(?)", [name]), table);
    await compareIndexes({ db, name, table, profile });
  }
}
