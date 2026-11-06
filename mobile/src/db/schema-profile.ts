import { schemaIdentifier, sqlTokens, UnsupportedSchemaDefinitionError } from "./schema-sql.ts";
import { tableShape } from "./schema-table.ts";
import type { TableShape } from "./schema-table.ts";

export interface SchemaObject {
  readonly type: "table" | "index" | "trigger";
  readonly name: string;
  readonly table: string;
  readonly tokens: readonly string[];
}
export interface SchemaProfile {
  readonly objects: ReadonlyMap<string, SchemaObject>;
  readonly tables: ReadonlyMap<string, TableShape>;
  readonly identifiers: ReadonlySet<string>;
}
function createdObject(tokens: readonly string[]): SchemaObject {
  const type = tokens[1] === "unique" ? tokens[2] : tokens[1];
  if (type !== "table" && type !== "index" && type !== "trigger")
    throw new UnsupportedSchemaDefinitionError("Unsupported CREATE form.");
  const name = schemaIdentifier(tokens[tokens[1] === "unique" ? 3 : 2]);
  const table = type === "table" ? name : schemaIdentifier(tokens[tokens.indexOf("on") + 1]);
  return { type, name, table, tokens };
}
function appendColumn(objects: Map<string, SchemaObject>, tokens: readonly string[]): void {
  if (
    tokens[1] !== "table" ||
    tokens[3] !== "add" ||
    tokens[4] !== "column" ||
    tokens.includes(";")
  )
    throw new UnsupportedSchemaDefinitionError("Unsupported ALTER form.");
  const name = schemaIdentifier(tokens[2]);
  const previous = objects.get(name);
  if (previous?.type !== "table" || previous.tokens.at(-1) !== ")")
    throw new UnsupportedSchemaDefinitionError("Unsupported ALTER target.");
  objects.set(name, {
    ...previous,
    tokens: [...previous.tokens.slice(0, -1), ",", ...tokens.slice(5), ")"],
  });
}
function foldOtherStatement(objects: Map<string, SchemaObject>, tokens: readonly string[]): void {
  if (tokens[0] === "drop" && tokens[1] === "trigger" && tokens.length === 3) {
    if (!objects.delete(schemaIdentifier(tokens[2])))
      throw new UnsupportedSchemaDefinitionError("Unknown DROP target.");
    return;
  }
  if (tokens.includes(";"))
    throw new UnsupportedSchemaDefinitionError("Unsupported compound migration.");
  if (
    ["insert into kv", "insert into attachment_context"].includes(tokens.slice(0, 3).join(" ")) ||
    tokens.slice(0, 2).join(" ") === "update day_assignment"
  )
    return;
  throw new UnsupportedSchemaDefinitionError("Unsupported migration statement.");
}
function foldStatement(objects: Map<string, SchemaObject>, sql: string): void {
  const tokens = sqlTokens(sql);
  if (tokens[0] === "create") {
    const object = createdObject(tokens);
    objects.set(object.name, object);
    return;
  }
  if (tokens[0] === "alter") {
    appendColumn(objects, tokens);
    return;
  }
  foldOtherStatement(objects, tokens);
}
function captureProfile(objects: ReadonlyMap<string, SchemaObject>): SchemaProfile {
  const tables = new Map(
    [...objects.values()]
      .filter((object) => object.type === "table")
      .map((object) => [object.name, tableShape(object.tokens)] as const),
  );
  const identifiers = new Set(objects.keys());
  for (const table of tables.values())
    for (const column of table.columns) identifiers.add(column.name);
  return { objects: new Map(objects), tables, identifiers };
}
/** One source of prefix expectations: the actual released canonical statement arrays. */
export function schemaProfiles(
  migrations: readonly (readonly string[])[],
): readonly SchemaProfile[] {
  const objects = new Map<string, SchemaObject>();
  const profiles: SchemaProfile[] = [captureProfile(objects)];
  for (const migration of migrations) {
    for (const sql of migration) foldStatement(objects, sql);
    profiles.push(captureProfile(objects));
  }
  return profiles;
}
