import assert from "node:assert/strict";
import { test } from "node:test";
import { parseQr } from "../src/features/ovitrap-check/domain.ts";
import { resolveScanner } from "../src/features/scanner/domain.ts";
import { ScannerSession } from "../src/features/scanner/scanner-session.ts";
import { navigationReducer } from "../src/navigation/routes.ts";

const ID = "10000000-0000-4000-8000-000000000001";
void test("M07 shared parser routes all five canonical kinds without a requested kind", () => {
  for (const kind of ["lot", "ovitrap", "bag", "release-device", "sample"] as const)
    assert.deepEqual(parseQr(`wbf:1:${kind}:${ID}`), { kind, id: ID });
});

void test("M07 rejects URLs, malformed ASCII grammar, unsupported versions/kinds and bad UUIDs", () => {
  const errors = [
    ["https://example.test", "invalid"],
    [` wbf:1:lot:${ID}`, "invalid"],
    [`wbf:1:lot:${ID}\n`, "invalid"],
    [`wbf:2:lot:${ID}`, "version"],
    [`wbf:1:unknown:${ID}`, "kind"],
    ["wbf:1:lot:bad-id", "invalid"],
    [`wbf:1:ｌot:${ID}`, "invalid"],
  ];
  for (const [value = "", error] of errors)
    assert.deepEqual(resolveScanner({ value, isManual: false }, []), { error });
});
void test("M07 typed local routes require one exact scoped identity and manual codes stay explicit", () => {
  for (const kind of ["lot", "ovitrap", "bag", "release-device", "sample"] as const) {
    const resource = { kind, id: ID, code: "OV-010" };
    assert.deepEqual(
      resolveScanner({ value: `wbf:1:${kind}:${ID}`, isManual: false }, [resource]),
      { resource, manualCapture: false },
    );
    assert.deepEqual(resolveScanner({ value: "OV-010", isManual: true }, [resource]), {
      resource,
      manualCapture: true,
    });
  }
  const resource = { kind: "ovitrap" as const, id: ID, code: "OV-010" };
  const printed = { ...resource, code: "OV–Ñ" };
  assert.deepEqual(resolveScanner({ value: printed.code, isManual: true }, [printed]), {
    resource: printed,
    manualCapture: true,
  });
  const input = { value: `wbf:1:ovitrap:${ID}`, isManual: false };
  assert.deepEqual(resolveScanner(input, []), { error: "unavailable" });
  assert.deepEqual(resolveScanner({ ...input, expected: "bag" }, [resource]), { error: "kind" });
  assert.deepEqual(resolveScanner(input, [{ ...resource, isRetired: true }]), { error: "retired" });
  assert.deepEqual(resolveScanner({ value: "OV-010", isManual: true }, [resource, resource]), {
    error: "unavailable",
  });
  assert.deepEqual(resolveScanner({ value: "OV-010", isManual: false }, [resource]), {
    error: "invalid",
  });
});
void test("M07 duplicate callbacks have no effects and cancellation fences late results without timeouts", async () => {
  const session = new ScannerSession();
  let release: (() => void) | undefined;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  let writes = 0;
  const first = session.run(ID, async (isCurrent) => {
    await barrier;
    if (isCurrent()) writes++;
  });
  assert.equal(
    await session.run(ID, () => {
      writes++;
      return Promise.resolve();
    }),
    "duplicate",
  );
  assert.equal(session.isBusy, true, "duplicate feedback cannot re-enable an in-flight capture");
  session.cancel();
  release?.();
  await first;
  assert.equal(writes, 0);
  await session.run(ID, () => {
    writes++;
    return Promise.resolve();
  });
  assert.equal(
    await session.run(ID, () => {
      writes++;
      return Promise.resolve();
    }),
    "duplicate",
  );
  assert.equal(writes, 1);
  session.cancel();
  await session.run(ID, () => {
    writes++;
    return Promise.resolve();
  });
  assert.equal(writes, 2, "a later legitimate capture of the same identity stays possible");
});

void test("M07 navigation does not coalesce different originating captures or supply identities", () => {
  const origin = { name: "ovitrapScanner" as const, target: "bag" as const, eventId: ID };
  const original = navigationReducer([{ name: "home" }], { type: "push", route: origin });
  assert.equal(navigationReducer(original, { type: "push", route: origin }), original);
  assert.equal(
    navigationReducer(original, { type: "push", route: { ...origin, eventId: null } }).length,
    3,
  );
  const detail = navigationReducer([{ name: "home" }], {
    type: "push",
    route: { name: "supplyDetail", lotId: ID },
  });
  assert.equal(
    navigationReducer(detail, {
      type: "push",
      route: { name: "supplyDetail", lotId: "another-lot" },
    }).length,
    3,
  );
});
