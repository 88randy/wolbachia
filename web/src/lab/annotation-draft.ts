import type { AnnotationMark } from "./annotation-state";
import { MAX_ANNOTATION_MARKS } from "./annotation-state";

export interface AnnotationDraft {
  version: 1;
  file: File;
  clientId: string;
  marks: AnnotationMark[];
}
const DATABASE = "aedesvision-egg-drafts";
const STORE = "drafts";

function openDraftDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () => {
      reject(new Error("Annotation draft database request failed", { cause: request.error }));
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

/** Only authored files and marks are stored. No API responses or download URLs enter this store. */
export async function readAnnotationDraft(key: string): Promise<AnnotationDraft | undefined> {
  const database = await openDraftDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STORE).objectStore(STORE).get(key);
      request.onsuccess = () => {
        const stored: unknown = request.result;
        if (stored !== undefined && !isAnnotationDraft(stored))
          reject(new Error("Invalid egg annotation draft"));
        else resolve(stored);
      };
      request.onerror = () => {
        reject(new Error("Annotation draft database request failed", { cause: request.error }));
      };
    });
  } finally {
    database.close();
  }
}

function isAnnotationDraft(value: unknown): value is AnnotationDraft {
  if (!isRecord(value)) return false;
  return (
    value.version === 1 &&
    value.file instanceof File &&
    isClientId(value.clientId) &&
    isDraftMarks(value.marks)
  );
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function isClientId(value: unknown) {
  return typeof value === "string" && /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(value);
}
function isDraftMarks(value: unknown) {
  return Array.isArray(value) && value.length <= MAX_ANNOTATION_MARKS && value.every(isDraftMark);
}
function isDraftMark(value: unknown): value is AnnotationMark {
  if (!isRecord(value)) return false;
  if (!isPixel(value.x) || !isPixel(value.y)) return false;
  if (value.kind === "point") return true;
  return value.kind === "box" && isBoxSize(value);
}
function isBoxSize(value: Record<string, unknown>) {
  return isPixel(value.w) && isPixel(value.h) && value.w > 0 && value.h > 0;
}
function isPixel(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export async function writeAnnotationDraft(key: string, draft: AnnotationDraft | null) {
  const database = await openDraftDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      if (draft) store.put(draft, key);
      else store.delete(key);
      transaction.oncomplete = () => {
        resolve();
      };
      transaction.onerror = () => {
        reject(new Error("Annotation draft transaction failed", { cause: transaction.error }));
      };
      transaction.onabort = () => {
        reject(new Error("Annotation draft transaction failed", { cause: transaction.error }));
      };
    });
  } finally {
    database.close();
  }
}
