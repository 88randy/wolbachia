type ClassName = string | false | null | undefined;

/** Joins the class names that are set. CSS-module lookups are `string | undefined`. */
export function classNames(...parts: ClassName[]): string {
  return parts.filter((part): part is string => typeof part === "string" && part !== "").join(" ");
}
