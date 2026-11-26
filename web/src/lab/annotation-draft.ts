import type { AnnotationMark } from "./annotation-state";
import { MAX_ANNOTATION_MARKS } from "./annotation-state";

export interface AnnotationDraft {
  version: 1;
  file: File;
  clientId: string;
  marks: AnnotationMark[];
}
interface StoredDraft {
  version: 2;
  clientId: string;
  marks: AnnotationMark[];
  updatedAt: number;
}
const DATABASE = "aedesvision-egg-drafts";
const STORE = "drafts";
const IMAGES = "images";
const DRAFT_TTL_MS = 72 * 60 * 60 * 1000;
let generation = 0;
let tail: Promise<unknown> = Promise.resolve();

export function annotationDraftGeneration() {
  return generation;
}

function enqueue<Result>(operation: () => Promise<Result>): Promise<Result> {
  const next = tail.then(operation);
  tail = next.catch(() => undefined);
  return next;
}

function openDraftDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 2);
    request.onupgradeneeded = () => {
      upgradeDraftDatabase(request);
    };
    request.onerror = () => {
      reject(new Error("Annotation draft database request failed", { cause: request.error }));
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

function upgradeDraftDatabase(request: IDBOpenDBRequest) {
  const database = request.result;
  const images = database.createObjectStore(IMAGES);
  if (!database.objectStoreNames.contains(STORE)) {
    database.createObjectStore(STORE);
    return;
  }
  const cursor = request.transaction?.objectStore(STORE).openCursor();
  if (!cursor) return;
  cursor.onsuccess = () => {
    const row = cursor.result;
    if (!row) return;
    const value: unknown = row.value;
    if (isAnnotationDraft(value)) {
      images.put(value.file, row.key);
      row.update(storedDraft(value, value.file.lastModified));
    } else row.delete();
    row.continue();
  };
}

function completed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve();
    };
    transaction.onerror = transaction.onabort = () => {
      reject(new Error("Annotation draft transaction failed", { cause: transaction.error }));
    };
  });
}

function purgeExpiredDrafts(database: IDBDatabase) {
  const transaction = database.transaction([STORE, IMAGES], "readwrite");
  const cursor = transaction.objectStore(STORE).openCursor();
  cursor.onsuccess = () => {
    const row = cursor.result;
    if (!row) return;
    const value: unknown = row.value;
    if (!isStoredDraft(value) || Date.now() - value.updatedAt >= DRAFT_TTL_MS) {
      transaction.objectStore(IMAGES).delete(row.key);
      row.delete();
    }
    row.continue();
  };
  return completed(transaction);
}

async function withDatabase<Result>(operation: (database: IDBDatabase) => Promise<Result>) {
  const database = await openDraftDatabase();
  try {
    await purgeExpiredDrafts(database);
    return await operation(database);
  } finally {
    database.close();
  }
}

/** Blob and marks occupy separate stores: autosave never serializes the original photo again. */
export function readAnnotationDraft(key: string): Promise<AnnotationDraft | undefined> {
  return enqueue(() =>
    withDatabase(async (database) => {
      const transaction = database.transaction([STORE, IMAGES]);
      const metadata = transaction.objectStore(STORE).get(key);
      const image = transaction.objectStore(IMAGES).get(key);
      await completed(transaction);
      const stored: unknown = metadata.result;
      const file: unknown = image.result;
      if (!isStoredDraft(stored) || !(file instanceof File)) return undefined;
      return { version: 1, file, clientId: stored.clientId, marks: stored.marks };
    }),
  );
}

function storedDraft(
  draft: Omit<AnnotationDraft, "file" | "version">,
  updatedAt = Date.now(),
): StoredDraft {
  return { version: 2, clientId: draft.clientId, marks: draft.marks, updatedAt };
}

export function writeAnnotationDraft(
  key: string,
  draft: AnnotationDraft | null,
  expectedGeneration = generation,
) {
  return enqueue(async () => {
    if (expectedGeneration !== generation) return;
    await withDatabase((database) => {
      const transaction = database.transaction([STORE, IMAGES], "readwrite");
      if (draft) {
        transaction.objectStore(IMAGES).put(draft.file, key);
        transaction.objectStore(STORE).put(storedDraft(draft), key);
      } else {
        transaction.objectStore(IMAGES).delete(key);
        transaction.objectStore(STORE).delete(key);
      }
      return completed(transaction);
    });
  });
}

export function writeAnnotationDraftMarks(
  key: string,
  marks: AnnotationMark[],
  expectedGeneration: number,
) {
  return enqueue(async () => {
    if (expectedGeneration !== generation) return;
    await withDatabase((database) => {
      const transaction = database.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      const request = store.get(key);
      request.onsuccess = () => {
        const previous: unknown = request.result;
        if (isStoredDraft(previous))
          store.put(storedDraft({ clientId: previous.clientId, marks }), key);
      };
      return completed(transaction);
    });
  });
}

/** Fence stale editors synchronously, then delete all users' photos and marks behind pending writes. */
export function purgeAnnotationDrafts(): Promise<void> {
  generation += 1;
  return enqueue(
    () =>
      new Promise<void>((resolve, reject) => {
        if (typeof indexedDB === "undefined") {
          resolve();
          return;
        }
        const request = indexedDB.deleteDatabase(DATABASE);
        request.onsuccess = () => {
          resolve();
        };
        request.onerror = () => {
          reject(new Error("Unable to purge annotation drafts", { cause: request.error }));
        };
      }),
  );
}

function isStoredDraft(value: unknown): value is StoredDraft {
  return (
    isRecord(value) &&
    value.version === 2 &&
    isClientId(value.clientId) &&
    isDraftMarks(value.marks) &&
    typeof value.updatedAt === "number" &&
    Number.isFinite(value.updatedAt)
  );
}
function isAnnotationDraft(value: unknown): value is AnnotationDraft {
  return (
    isRecord(value) &&
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
  if (!isRecord(value) || !isPixel(value.x) || !isPixel(value.y)) return false;
  if (value.kind === "point") return true;
  return value.kind === "box" && isPixel(value.w) && isPixel(value.h) && value.w > 0 && value.h > 0;
}
function isPixel(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
