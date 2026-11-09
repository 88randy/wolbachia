import { mkdtemp, mkdir, open, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import type { TestContext } from "node:test";
import type { SqlExecutor } from "../../src/db/sql.ts";
import { openTestDatabase } from "./sqlite-executor.ts";
import { KvStore } from "../../src/db/kv-store.ts";
import { OutboxRepository } from "../../src/outbox/outbox-repository.ts";
import { AttachmentStore } from "../../src/attachments/attachment-store.ts";
import { EvidenceSession } from "../../src/attachments/evidence-session.ts";
import type { EvidenceIdentity } from "../../src/attachments/evidence-session.ts";
import type { PrivateFiles } from "../../src/attachments/owned-files.ts";
export const OWNER = {
  issuer: "https://api.example.test",
  organizationId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  deviceId: "33333333-3333-4333-8333-333333333333",
};
export const EVIDENCE_ID = "66666666-6666-4666-8666-666666666666";
export const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
export const NOW = new Date("2026-11-06T15:00:00.000Z");

/** Real files exercise OUR bounded copy/hash contract; native Expo execution remains separate. */
export function nodePrivateFiles(root: string): PrivateFiles {
  return {
    owns: (ref) =>
      resolve(ref).startsWith(`${resolve(root)}\\`) || resolve(ref).startsWith(`${resolve(root)}/`),
    openRead: async (ref) => {
      const handle = await open(ref, "r");
      return {
        read: async (length) => {
          const buffer = Buffer.alloc(length);
          const { bytesRead } = await handle.read(buffer);
          return buffer.subarray(0, bytesRead);
        },
        close: () => handle.close(),
      };
    },
    createExclusive: async (id) => {
      const ref = join(root, id);
      const handle = await open(ref, "wx");
      return {
        ref,
        writer: { write: (bytes) => handle.writeFile(bytes), close: () => handle.close() },
      };
    },
  };
}
export async function attachmentHarness(test: TestContext, throughSchema?: number) {
  const root = await mkdtemp(join(tmpdir(), "wolbachia-246-"));
  const owned = join(root, "owned");
  await mkdir(owned);
  const path = join(root, "journal.sqlite");
  let database = await openTestDatabase(path, throughSchema);
  test.after(async () => {
    database.close();
    await removeFixture(root);
  });
  let identity: EvidenceIdentity | null = { owner: OWNER, sessionId: "session-one" };
  const source = join(root, "source.png");
  await writeFile(source, PNG_BYTES);
  const stores = () => localStores(database.executor, () => identity);
  return {
    ...stores(),
    source,
    files: nodePrivateFiles(owned),
    setIdentity: (next: EvidenceIdentity | null) => {
      identity = next;
    },
    reopen: async () => {
      database.close();
      database = await openTestDatabase(path);
      return stores();
    },
  };
}

async function removeFixture(root: string): Promise<void> {
  const expected = resolve(tmpdir());
  if (
    !resolve(root).startsWith(expected + "\\wolbachia-246-") &&
    !resolve(root).startsWith(expected + "/wolbachia-246-")
  )
    throw new Error("Unsafe fixture path.");
  await rm(root, { recursive: true });
}
function localStores(db: SqlExecutor, current: () => EvidenceIdentity | null) {
  const store = new AttachmentStore(db);
  const session = new EvidenceSession({ store, current, isFinal: () => current() === null });
  return { db, store, session, kv: new KvStore(db), outbox: new OutboxRepository(db, () => NOW) };
}
