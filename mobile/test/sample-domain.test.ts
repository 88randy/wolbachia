import assert from "node:assert/strict";
import { test } from "node:test";
import {
  methodVerified,
  sampleEvent,
  sampleGates,
  sourceEffective,
} from "../src/features/samples/domain.ts";
import {
  sampleDraft,
  sampleId,
  sampleMethod,
  sampleProjection,
  sampleSnapshot,
  sampleSource,
  SAMPLE_NOW,
  SAMPLE_ORIGIN,
} from "./support/sample-fixtures.ts";

void test("samples require original and current verified exact method and effective canonical source clocks", () => {
  const draft = sampleDraft(),
    source = sampleProjection();
  assert.deepEqual(sampleGates(draft, source), []); // No scientific GPS threshold is invented.
  assert.ok(
    sampleGates(draft, { ...source, snapshot: sampleSnapshot({ methods: [] }) }).includes("method"),
  );
  assert.ok(
    sampleGates(
      { ...draft, method: { ...sampleMethod(), supports_wolbachia: false } },
      source,
    ).includes("method"),
  );
  assert.ok(
    sampleGates(draft, { ...source, snapshot: sampleSnapshot({ sources: [] }) }).includes("source"),
  );
  assert.equal(
    methodVerified(
      {
        ...sampleMethod(),
        verification: { ...sampleMethod().verification, content_hash: "b".repeat(64) },
      },
      draft.deviceTime,
    ),
    false,
  );
  assert.equal(
    sourceEffective(
      { ...sampleSource(), lot_version_created_at: "2027-01-01T00:00:00Z" },
      source.handle.owner.userId,
      draft.deviceTime,
    ),
    false,
  );
  const reading = {
    ...sampleSource(),
    kind: "reading" as const,
    author_id: sampleId(90),
    device_time: draft.deviceTime,
  };
  assert.equal(sourceEffective(reading, source.handle.owner.userId, draft.deviceTime), false);
  assert.equal(
    sourceEffective(
      { ...reading, author_id: source.handle.owner.userId, device_time: "2027-01-01T00:00:00Z" },
      source.handle.owner.userId,
      draft.deviceTime,
    ),
    false,
  );
  assert.ok(
    sampleGates(draft, {
      ...source,
      snapshot: sampleSnapshot({ valid_until: SAMPLE_NOW.toISOString() }),
    }).includes("configuration"),
  );
});
void test("archived and current origins enforce explicit Other and photo proof without rewriting raw fields", () => {
  const draft = sampleDraft(),
    source = sampleProjection();
  assert.ok(sampleGates({ ...draft, evidence: [] }, source).includes("evidence"));
  assert.ok(sampleGates({ ...draft, otherText: "retained raw" }, source).includes("other"));
  const other = { ...SAMPLE_ORIGIN, code: "other", is_other: true };
  const otherDraft = { ...draft, originCode: "other", origin: other, otherText: "a" };
  const choices = { ...source, origins: [other] };
  assert.equal(sampleGates(otherDraft, choices).includes("other"), false);
  for (const text of ["", "\u200b", "\u202awrong", "a\u0000"])
    assert.ok(sampleGates({ ...otherDraft, otherText: text }, choices).includes("other"));
  assert.ok(sampleGates(draft, { ...source, origins: [] }).includes("origin"));
  const envelope = sampleEvent({ ...otherDraft, code: "  S-139  ", otherText: "  a  " });
  assert.equal(envelope.payload.code, "S-139");
  assert.equal(envelope.payload.other_text, "a");
  assert.equal(envelope.payload.sample_id, draft.sampleId);
  assert.notEqual(envelope.id, envelope.payload.sample_id);
  assert.equal("quantity" in envelope.payload, false);
});
