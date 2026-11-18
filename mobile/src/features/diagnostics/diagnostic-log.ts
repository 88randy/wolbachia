/**
 * Technical lines for failed local saves: error class, SQLite constraint kind and the table or
 * column it names, and which statement of the batch was involved. Never payload values or
 * personal data: only fixed words, table/column names and the trigger's own fixed message.
 */
interface StatementLike {
  readonly sql: string;
}

const MAX_ENTRIES = 20;
const MAX_LINE = 240;
const SAFE_DETAIL = /^[A-Za-z0-9_.,' :-]+$/;
const MAX_MESSAGE = 120;

const KINDS: readonly (readonly [RegExp, string])[] = [
  [/NOT NULL constraint failed:\s*([\w.,\s]+)/i, "SQLITE_CONSTRAINT_NOTNULL"],
  [/UNIQUE constraint failed:\s*([\w.,\s]+)/i, "SQLITE_CONSTRAINT_UNIQUE"],
  [/PRIMARY KEY constraint failed:\s*([\w.,\s]+)/i, "SQLITE_CONSTRAINT_PRIMARYKEY"],
  [/FOREIGN KEY constraint failed/i, "SQLITE_CONSTRAINT_FOREIGNKEY"],
  [/CHECK constraint failed:?\s*([\w.,\s]*)/i, "SQLITE_CONSTRAINT_CHECK"],
  [/(?:disk is full|SQLITE_FULL|ENOSPC)/i, "SQLITE_FULL"],
  [/(?:database is locked|SQLITE_BUSY)/i, "SQLITE_BUSY"],
];

function classify(message: string): { code: string; detail: string } {
  for (const [pattern, code] of KINDS) {
    const match = pattern.exec(message);
    if (match) return { code, detail: (match[1] ?? "").trim() };
  }
  const named = /SQLITE_[A-Z_]+/.exec(message);
  if (named) return { code: named[0], detail: "" };
  // A trigger's RAISE(ABORT, 'fixed text'): the text is written by us, never data.
  const raised = /(?:abort|constraint)[^a-z]*:?\s*([a-z][a-z0-9 ,'-]{8,80})$/i.exec(message.trim());
  const text = raised?.[1]?.trim() ?? "";
  return text && SAFE_DETAIL.test(text)
    ? { code: "SQLITE_CONSTRAINT_TRIGGER", detail: text }
    : { code: "UNKNOWN", detail: "" };
}

/** `INSERT attachment_event` style name of the first statement that touches the named table. */
function statementName(detail: string, statements: readonly StatementLike[]): string {
  const table = /^(\w+)\./.exec(detail)?.[1];
  const found =
    table === undefined
      ? undefined
      : statements.find((statement) => new RegExp(`\\b${table}\\b`, "i").test(statement.sql));
  if (!found) return "";
  const verb = /^\s*(INSERT|UPDATE|DELETE)/i.exec(found.sql)?.[1]?.toUpperCase() ?? "SQL";
  const target = /(?:INTO|UPDATE|FROM)\s+(\w+)/i.exec(found.sql)?.[1] ?? table;
  return `${verb} ${target}`;
}

/** One short line, for example `Código: SQLITE_CONSTRAINT_NOTNULL attachment_event.evidence_id [INSERT attachment_event]`. */
export function describeWriteFailure(
  cause: unknown,
  statements: readonly StatementLike[] = [],
): string {
  const message = cause instanceof Error ? cause.message : "";
  const name = cause instanceof Error ? cause.name : typeof cause;
  const { code, detail } = classify(message);
  const safeDetail = SAFE_DETAIL.test(detail) ? detail : "";
  const statement = statementName(safeDetail, statements);
  const own = code === "UNKNOWN" || safeDetail === "" ? sanitizeMessage(name, message) : "";
  const parts = [
    `Código: ${code}`,
    safeDetail,
    own,
    statement ? `[${statement}]` : "",
    `(${name}${throwSite(cause)})`,
  ];
  return parts.filter(Boolean).join(" ").slice(0, MAX_LINE);
}

/**
 * Our own errors carry fixed English messages, not data. Anything that can quote data (JSON parse
 * errors) is dropped; ids, long numbers and quoted text are masked; unusual characters become "?".
 */
function sanitizeMessage(name: string, message: string): string {
  if (name === "SyntaxError" || message === "") return "";
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/(["'`]).*?\1/g, "<text>")
    .replace(/\d{5,}/g, "<n>")
    .replace(/[^A-Za-z0-9 .:,<>_()[\]=/-]/g, "?")
    .slice(0, MAX_MESSAGE);
}

/** Up to three function names from the top of the stack (identifiers only), skipping constructors. */
function throwSite(cause: unknown): string {
  const stack = cause instanceof Error ? cause.stack : undefined;
  if (stack === undefined) return "";
  const names: string[] = [];
  for (const line of stack.split("\n")) {
    const match = /^\s*(?:at\s+)?([\w#.$<>]+)(?:@|\s*\()/.exec(line);
    const frame = match?.[1];
    if (frame !== undefined && frame !== "new" && !frame.startsWith("Error")) names.push(frame);
    if (names.length === 3) break;
  }
  return names.length === 0 ? "" : ` @${names.join("<")}`;
}

export interface DiagnosticEntry {
  readonly at: string;
  readonly line: string;
}

export interface DiagnosticSink {
  load(): Promise<readonly DiagnosticEntry[]>;
  save(entries: readonly DiagnosticEntry[]): Promise<void>;
}

/** The last technical lines, in memory and, once a sink is attached, on the phone. */
export class DiagnosticLog {
  #entries: readonly DiagnosticEntry[] = [];
  #sink: DiagnosticSink | null = null;
  readonly #listeners = new Set<() => void>();

  attach(sink: DiagnosticSink): Promise<void> {
    this.#sink = sink;
    return sink
      .load()
      .then((stored) => {
        this.#entries = [...this.#entries, ...stored].slice(-MAX_ENTRIES);
        this.#emit();
      })
      .catch(() => undefined);
  }

  record(line: string, at: Date = new Date()): void {
    this.#entries = [...this.#entries, { at: at.toISOString(), line }].slice(-MAX_ENTRIES);
    this.#emit();
    void this.#sink?.save(this.#entries).catch(() => undefined);
  }

  entries = (): readonly DiagnosticEntry[] => this.#entries;

  last = (): DiagnosticEntry | null => this.#entries.at(-1) ?? null;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  #emit(): void {
    for (const listener of this.#listeners) listener();
  }
}

export const diagnostics = new DiagnosticLog();
