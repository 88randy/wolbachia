/**
 * Permission codes of W62 (docs/api-conventions.md, "Permission codes (#3)"). The screen asks
 * `GET /me/` for them; it never looks at a profile name.
 */
/** The parameter list and a parameter's current value. */
export const RULE_PARAMETER_READ = "rule_parameter.read";
/** The version history of a parameter (admin only by default). */
export const RULE_VERSION_READ = "rule_parameter_version.read";
export const RULE_VERSION_CREATE = "rule_parameter_version.create";
export const RULE_VERSION_VOID = "rule_parameter_version.void";
/** The void dialog lists the reasons of the `void-reason` catalog, so voiding also needs this (#80). */
export const CATALOG_READ = "catalog.read";
