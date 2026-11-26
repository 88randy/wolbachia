import { register } from "node:module";

/**
 * Resolves native-only packages to inert modules. Node cannot load them (TypeScript sources under
 * node_modules, extensionless imports) and these tests never reach a device API. Import this file,
 * then `await import(...)` the production module that pulls a package in, because static imports
 * are resolved before any code runs.
 */
const STUBS: Readonly<Record<string, string>> = {
  "expo-image-picker":
    "export const getCameraPermissionsAsync = async () => ({ granted: false, canAskAgain: false });",
  "expo-file-system":
    "export class File { constructor() { this.exists = false; } }\n" +
    "export class Directory { constructor() { this.exists = false; } }\n" +
    "export const Paths = { document: '' };",
};
const HOOKS = `
const stubs = ${JSON.stringify(STUBS)};
export async function resolve(specifier, context, next) {
  if (Object.hasOwn(stubs, specifier))
    return { url: "data:text/javascript," + encodeURIComponent(stubs[specifier]), shortCircuit: true };
  return next(specifier, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);
