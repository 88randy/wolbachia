/** A lexer for our released DDL forms, not a SQL parser or a literal rewriter. */
const TOKEN =
  /'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\]|[a-z_][a-z_0-9]*|\d+|<>|!=|<=|>=|\|\||[(),.=+*/<>;%-]/giy;

export class UnsupportedSchemaDefinitionError extends Error {}

export function sqlTokens(sql: string): readonly string[] {
  const tokens: string[] = [];
  let cursor = 0;
  while (cursor < sql.length) {
    if (/\s/.test(sql[cursor] ?? "")) {
      cursor++;
      continue;
    }
    TOKEN.lastIndex = cursor;
    const match = TOKEN.exec(sql);
    if (!match) throw new UnsupportedSchemaDefinitionError("Unsupported schema token.");
    const token = match[0];
    tokens.push(/^[a-z_]/i.test(token) ? token.toLowerCase() : token);
    cursor = TOKEN.lastIndex;
  }
  if (tokens.at(-1) === ";") tokens.pop();
  return tokens;
}

/** Compare literal tokens exactly; only an expected canonical identifier permits quoting. */
export function matchingSqlTokens(input: {
  actual: readonly string[];
  expected: readonly string[];
  identifiers: ReadonlySet<string>;
}): boolean {
  if (input.actual.length !== input.expected.length) return false;
  return input.expected.every((expected, index) => {
    const actual = input.actual[index];
    if (actual === expected) return true;
    if (!actual || !input.identifiers.has(expected)) return false;
    if (!['"', "`", "["].includes(actual[0] ?? "")) return false;
    return actual.slice(1, -1).toLowerCase() === expected;
  });
}

export function splitDefinitions(tokens: readonly string[]): readonly (readonly string[])[] {
  const parts: string[][] = [[]];
  let depth = 0;
  for (const token of tokens) {
    if (token === "," && depth === 0) {
      parts.push([]);
      continue;
    }
    if (token === "(") depth++;
    if (token === ")") depth--;
    if (depth < 0) throw new UnsupportedSchemaDefinitionError("Unbalanced schema.");
    parts[parts.length - 1]?.push(token);
  }
  if (depth !== 0) throw new UnsupportedSchemaDefinitionError("Unbalanced schema.");
  return parts;
}

export function insideParentheses(tokens: readonly string[]): readonly string[] {
  const opening = tokens.indexOf("(");
  if (opening < 0 || tokens.at(-1) !== ")")
    throw new UnsupportedSchemaDefinitionError("Unsupported schema definition.");
  return tokens.slice(opening + 1, -1);
}

export function firstParentheses(tokens: readonly string[]): readonly string[] {
  const opening = tokens.indexOf("(");
  let depth = 0;
  for (let index = opening; index < tokens.length && index >= 0; index++) {
    if (tokens[index] === "(") depth++;
    if (tokens[index] === ")") depth--;
    if (depth === 0) return tokens.slice(opening + 1, index);
  }
  throw new UnsupportedSchemaDefinitionError("Unbalanced schema.");
}

export function schemaIdentifier(value: string | undefined): string {
  if (!value || !/^[a-z_][a-z_0-9]*$/.test(value))
    throw new UnsupportedSchemaDefinitionError("Unsupported schema identifier.");
  return value;
}
