# M04 shift opening and operational authorization

This folder owns the durable shift-opening draft, local opening event, safety
checklist, odometer/map preparation and departure gate. See `mobile/README.md`
for the existing behavior, unavailable production map/photo seams and device limits.
An opening stored on the phone is distinct from server receipt or review.

## Coherent gate read and original proof (#253)

`ShiftOpenService.read()` preserves its public ShiftSnapshot result. It delegates
to `readWithGuard()`, which also returns an internal SQL guard for the exact durable
facts passed to the existing gate logic. It can return a blocked snapshot: callers
must validate it rather than treating possession of the guard as permission.

`ShiftOpenStore.readGateFacts()` / `gate-facts.ts` use one SELECT for:

- the raw shift draft and its saved opening-event link;
- the actual opening identity, local status and server result_code;
- the current raw safety catalog and map preparation values.

The same SOURCE/FACTS definitions project those values and compare their originals
in the guard. The singleton LEFT JOIN preserves catalog/map reads before any shift
state exists. Existing write methods and KV key values are unchanged; catalog/map
key constants are shared with the coherent read.

The service applies the existing `departureGate`, opening outcome override and
`canDepart` calculation to those parsed facts. No checklist/map/odometer validation
is copied into SQL. `lastOdometer` affects a warning only; rules tokens, attempts,
retry metadata and result params are not departure-gate inputs and are excluded
from the guard.

M08 `readCaptureShift()` validates that same snapshot with `captureShiftId()` before
camera acquisition and retains its original guard through the final partial
reference UPDATE. A late severe server review cannot be hidden by an unchanged
shift UUID, attachment generation or M08 assignment. A later read may fail early
but cannot replace the original proof to bless an older camera result. No file or
network I/O runs under a database/auth/projection lock.

Any compared input change, including a benign status/result transition, rejects
the in-flight photo conservatively. Its private bytes/journal remain, and only the
still-current request can reload/retry. No automatic adoption or false Saved occurs.
This is a documented partial-delivery tradeoff awaiting MO01 qualification.

## Verification and scope

The existing shift-opening policy suite owns the gate cases. The actual file /
SQLite publication journey in `mobile/test/attachments.test.ts` adds a real
ShiftOpenService/Store opening and public outbox claim→severe_check review at the
last SQL boundary, with unchanged generation/assignment. It also checks catalog/map
availability before start. No duplicate gate matrix or manual status SQL is used.

This authorization read does not implement ShiftOpen PhotoCapturePort integration
([#260](https://github.com/88randy/wolbachia/issues/260)), camera permissions or M09.
No schema, auth policy, queue, scheduler or event contract changes are introduced.
Native camera/lifecycle/SQLCipher/API/accessibility qualification remains UNRUN;
see [#253 qualification](../../../../docs/qa/native-photo-253.md).
