import { z } from "zod";

/**
 * `validateSearch` of every list route: the query string is a flat record of strings (see
 * `router/flat-search.ts`). The table validates its own parameters (`readTableState`) and
 * ignores the rest, so the route only has to say the shape; with it, `<Link search={{...}}>` to a
 * list is typed and a number cell can link to the filtered list behind it.
 */
export const tableSearchSchema = z.record(z.string(), z.string());
