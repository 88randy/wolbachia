import * as ts from "typescript";

/**
 * Calls that only FILTER the cache (they take a `queryKey` to say which entries, not to define a
 * query). A `queryKey` property is legitimate there and nowhere else outside `session/` and `api/`.
 */
const FILTER_CALLS = new Set([
  "invalidateQueries",
  "removeQueries",
  "cancelQueries",
  "refetchQueries",
  "resetQueries",
  "isFetching",
  "getQueriesData",
  "setQueriesData",
  "getQueryData",
  "setQueryData",
  "getQueryState",
]);

function calleeName(call: ts.CallExpression): string | undefined {
  const { expression } = call;
  if (ts.isIdentifier(expression)) return expression.text;
  return ts.isPropertyAccessExpression(expression) ? expression.name.text : undefined;
}

function propertyName(node: ts.ObjectLiteralElementLike): string | undefined {
  const { name } = node;
  return name && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? name.text : undefined;
}

function enclosingCall(node: ts.Node): ts.CallExpression | undefined {
  return ts.findAncestor(node.parent, ts.isCallExpression);
}

/** A `queryKey` is only legitimate as the filter of a call that does not define a query. */
function isDefinedByHand(literal: ts.ObjectLiteralExpression): boolean {
  const call = enclosingCall(literal);
  const callee = call === undefined ? undefined : calleeName(call);
  return callee === undefined || !FILTER_CALLS.has(callee);
}

function problemInObject(literal: ts.ObjectLiteralExpression): string | undefined {
  const names = literal.properties.map(propertyName);
  if (names.includes("placeholderData")) return "overrides placeholderData";
  if (names.includes("queryKey") && isDefinedByHand(literal)) return "defines a queryKey by hand";
  return undefined;
}

/** What is wrong with `node`, if anything. */
function problemOf(node: ts.Node): string | undefined {
  if (ts.isIdentifier(node) && node.text === "keepPreviousData") {
    return "uses keepPreviousData (placeholders go through orgScopedQueryOptions)";
  }
  return ts.isObjectLiteralExpression(node) ? problemInObject(node) : undefined;
}

/**
 * Guard of #82. In a source file of a screen (not `session/`, `api/` or tests) every query is
 * defined with `orgScopedQueryOptions`: no `queryKey` of its own (`queryOptions({ queryKey })`,
 * `useQuery({ queryKey })`, shorthand included), no `placeholderData` and no `keepPreviousData`.
 * `invalidateQueries({ queryKey })` and the other calls that only filter the cache are fine.
 */
export function findUnscopedQueries(source: string): string[] {
  const file = ts.createSourceFile("file.tsx", source, ts.ScriptTarget.Latest, true);
  const problems: string[] = [];
  const visit = (node: ts.Node): void => {
    const problem = problemOf(node);
    if (problem !== undefined) problems.push(problem);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return problems;
}
