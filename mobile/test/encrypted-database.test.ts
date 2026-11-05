import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { it } from "node:test";

import { openEncryptedDatabase, DATABASE_NAME } from "../src/db/encrypted-database.ts";
import { memorySecrets } from "./support/auth-fakes.ts";
import type { SqlExecutor } from "../src/db/sql.ts";

void it("validates cipher, reads the file, saves the fresh key, then returns it to migrations", async () => {
  const order: string[] = [];
  const secrets = memorySecrets();
  const db: SqlExecutor = {
    query: (sql) => {
      order.push(sql);
      return Promise.resolve(sql.includes("cipher_version") ? [{ cipher_version: "4" }] : []);
    },
    runAtomically: () => Promise.resolve(),
  };
  await openEncryptedDatabase({
    secrets: {
      ...secrets,
      set: async (key, value) => {
        order.push("save");
        assert.equal(value.length, 64);
        await secrets.set(key, value);
      },
    },
    randomBytes,
    open: ({ name }) => {
      assert.equal(name, DATABASE_NAME);
      assert.notEqual(name, "wolbachia_field.db");
      return db;
    },
  });
  assert.deepEqual(order, ["PRAGMA cipher_version", "SELECT count(*) FROM sqlite_master", "save"]);
  order.length = 0;
  await openEncryptedDatabase({
    secrets,
    randomBytes: () => {
      throw new Error("An existing database key must never be regenerated.");
    },
    open: () => db,
  });
  assert.deepEqual(order, ["PRAGMA cipher_version", "SELECT count(*) FROM sqlite_master"]);
});

void it("fails closed without SQLCipher or on a wrong key; never persists a replacement", async () => {
  for (const failure of ["noRow", "empty", "wrongKey"]) {
    const secrets = memorySecrets();
    const db: SqlExecutor = {
      query: (sql) => {
        if (sql.includes("sqlite_master"))
          return Promise.reject(new Error("file is not a database"));
        return Promise.resolve(
          failure === "noRow" ? [] : [{ cipher_version: failure === "empty" ? "" : "4" }],
        );
      },
      runAtomically: () => Promise.resolve(),
    };
    await assert.rejects(openEncryptedDatabase({ secrets, randomBytes, open: () => db }));
    assert.equal(secrets.values.size, 0);
  }
});

void it("does not let migrations start when saving the newly validated key fails", async () => {
  const secrets = memorySecrets();
  const db: SqlExecutor = {
    query: () => Promise.resolve([{ cipher_version: "4" }]),
    runAtomically: () => Promise.resolve(),
  };
  await assert.rejects(
    openEncryptedDatabase({
      randomBytes,
      open: () => db,
      secrets: { ...secrets, set: () => Promise.reject(new Error("Keystore unavailable")) },
    }),
  );
  assert.equal(secrets.values.size, 0);
});
