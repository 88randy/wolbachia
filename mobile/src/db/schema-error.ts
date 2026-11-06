export class UnsupportedDatabaseLineageError extends Error {
  constructor() {
    super(
      "Unsupported database schema lineage. Retain the database and contact support; do not reset or uninstall.",
    );
    this.name = "UnsupportedDatabaseLineageError";
  }
}
export function requireSchemaMatch(isMatching: boolean): void {
  if (!isMatching) throw new UnsupportedDatabaseLineageError();
}
