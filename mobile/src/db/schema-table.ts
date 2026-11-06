import {
  insideParentheses,
  schemaIdentifier,
  splitDefinitions,
  UnsupportedSchemaDefinitionError,
} from "./schema-sql.ts";

export interface ColumnShape {
  readonly name: string;
  readonly type: string;
  readonly notnull: number;
  readonly dflt_value: string | null;
  readonly pk: number;
}
export interface ForeignKeyShape {
  readonly table: string;
  readonly from: string;
  readonly to: string;
}
export interface AutomaticIndex {
  readonly origin: "pk" | "u";
  readonly columns: readonly string[];
}
export interface TableShape {
  readonly columns: readonly ColumnShape[];
  readonly foreignKeys: readonly ForeignKeyShape[];
  readonly automaticIndexes: readonly AutomaticIndex[];
  readonly hasSequence: boolean;
}
function hasPair(tokens: readonly string[], first: string, second: string): boolean {
  return tokens.some((token, index) => token === first && tokens[index + 1] === second);
}
function columnShape(tokens: readonly string[]): ColumnShape {
  const type = tokens[1];
  if (type !== "text" && type !== "integer")
    throw new UnsupportedSchemaDefinitionError("Unsupported column type.");
  const defaultIndex = tokens.indexOf("default");
  return {
    name: schemaIdentifier(tokens[0]),
    type: type.toUpperCase(),
    notnull: Number(hasPair(tokens, "not", "null")),
    dflt_value: defaultIndex < 0 ? null : (tokens[defaultIndex + 1] ?? null),
    pk: Number(hasPair(tokens, "primary", "key")),
  };
}
function referencedColumn(tokens: readonly string[]): ForeignKeyShape | null {
  const reference = tokens.indexOf("references");
  if (reference < 0) return null;
  if (tokens[reference + 2] !== "(" || tokens[reference + 4] !== ")")
    throw new UnsupportedSchemaDefinitionError("Unsupported foreign key.");
  return {
    table: schemaIdentifier(tokens[reference + 1]),
    from: schemaIdentifier(tokens[0]),
    to: schemaIdentifier(tokens[reference + 3]),
  };
}
function primaryColumns(definitions: readonly (readonly string[])[]): readonly string[] {
  const tableKey = definitions.find((part) => part[0] === "primary" && part[1] === "key");
  if (tableKey)
    return insideParentheses(tableKey)
      .filter((token) => token !== ",")
      .map(schemaIdentifier);
  return definitions
    .filter((part) => hasPair(part, "primary", "key"))
    .map((part) => schemaIdentifier(part[0]));
}
function automaticIndexes(definitions: readonly (readonly string[])[]): readonly AutomaticIndex[] {
  return definitions.flatMap((part): AutomaticIndex[] => {
    if (part[0] === "primary")
      return [
        {
          origin: "pk",
          columns: insideParentheses(part)
            .filter((token) => token !== ",")
            .map(schemaIdentifier),
        },
      ];
    const columns = [schemaIdentifier(part[0])];
    const indexes: AutomaticIndex[] = [];
    if (hasPair(part, "primary", "key") && part[1] !== "integer")
      indexes.push({ origin: "pk", columns });
    if (part.includes("unique")) indexes.push({ origin: "u", columns });
    return indexes;
  });
}
/** Only the table/column forms present in the canonical migration arrays are supported. */
export function tableShape(tokens: readonly string[]): TableShape {
  const definitions = splitDefinitions(insideParentheses(tokens));
  const primary = primaryColumns(definitions);
  const columnDefinitions = definitions.filter((part) => part[0] !== "primary");
  const columns = columnDefinitions.map(columnShape).map((column) => ({
    ...column,
    pk: primary.indexOf(column.name) + 1,
  }));
  return {
    columns,
    foreignKeys: columnDefinitions.map(referencedColumn).filter((key) => key !== null),
    automaticIndexes: automaticIndexes(definitions),
    hasSequence: tokens.includes("autoincrement"),
  };
}
