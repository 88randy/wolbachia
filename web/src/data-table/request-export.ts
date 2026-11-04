import { ApiError, isErrorEnvelope } from "@wolbachia/api-client";
import type { ApiClient, ErrorEnvelope } from "@wolbachia/api-client";

/** `/api/v1/<resource>/export/`: the shape of an export endpoint (docs/api-conventions.md, "Exports"). */
const EXPORT_PATH =
  /^\/api\/v1\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*\/export\/$/;
const DEFAULT_FILE_NAME = "export.csv";
const FILE_NAME = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i;

export interface ExportFile {
  blob: Blob;
  fileName: string;
}

/** The file name the backend suggests in `Content-Disposition`, reduced to a safe base name. */
export function fileNameOf(contentDisposition: string | null): string {
  const raw = FILE_NAME.exec(contentDisposition ?? "")?.[1];
  if (raw === undefined) return DEFAULT_FILE_NAME;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // Not percent-encoded after all: use it as it came.
  }
  const base = decoded.split(/[\\/]/).pop() ?? "";
  return base === "" || base.startsWith(".") ? DEFAULT_FILE_NAME : base;
}

type ExportQuery = Readonly<Record<string, string | boolean>>;

/**
 * Asks the backend for the file of a list (`GET <exportPath>?format=csv&<filters>`). The server
 * builds it, applies the data-transfer authorizations and writes the access log: the browser
 * never exports rows it holds. A failure throws the `ApiError` of the answer.
 *
 * The OpenAPI schema has no export operation yet, so the path is a string checked against the
 * shape above and the typed call is bypassed here, in this one place. When the endpoints exist
 * they appear in `paths`: type `exportPath` with them and remove the casts.
 */
export async function requestExport(
  client: ApiClient,
  exportPath: string,
  query: ExportQuery,
): Promise<ExportFile> {
  if (!EXPORT_PATH.test(exportPath)) throw new TypeError(`Not an export path: ${exportPath}`);
  const result: unknown = await client.GET(
    exportPath as never,
    {
      params: { query: { ...query, format: "csv" } },
      parseAs: "blob",
    } as never,
  );
  const { data, error, response } = result as RawResult;
  if (!response.ok) throw new ApiError(response.status, await envelopeOf(error, data));
  return {
    blob: data ?? new Blob(),
    fileName: fileNameOf(response.headers.get("content-disposition")),
  };
}

/**
 * The error envelope of a failed export. With `parseAs: "blob"` the client may hand the JSON body
 * back as text or as a Blob instead of an object; without the envelope the code (a membership
 * loss, for instance) would be lost and the session would not react.
 */
async function envelopeOf(error: unknown, data: unknown): Promise<ErrorEnvelope | undefined> {
  for (const candidate of [error, data]) {
    const envelope = await parseEnvelope(candidate);
    if (envelope !== undefined) return envelope;
  }
  return undefined;
}

async function parseEnvelope(candidate: unknown): Promise<ErrorEnvelope | undefined> {
  if (isErrorEnvelope(candidate)) return candidate;
  const text = await textOf(candidate);
  if (text === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(text);
    return isErrorEnvelope(parsed) ? parsed : undefined;
  } catch {
    return undefined; // Not JSON (a proxy page): no envelope.
  }
}

async function textOf(value: unknown): Promise<string | undefined> {
  if (typeof value === "string") return value;
  return value instanceof Blob ? value.text() : undefined;
}

/** What openapi-fetch resolves to for a call: the parsed body, the error body, the response. */
interface RawResult {
  data?: Blob;
  error?: unknown;
  response: Response;
}
