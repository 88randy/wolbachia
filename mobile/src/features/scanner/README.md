# M07 QR routing (#136)

P11 and inline P21 feedback share the strict M08 `wbf:1:<kind>:<uuid>` parser.
Camera input never becomes manual input and never opens a URL. Explicit human-code
entry resolves one exact current downloaded code; ambiguous codes remain unavailable.
Home, the existing M08 scanner route and bag capture use the same native scanner.

One scanner session admits one callback at a time. Repeated callbacks only change
feedback. Retry rearms explicitly, so a later legitimate capture of the same UUID
is possible. Native permission uses the existing receipt scanner lease; lock,
background, session changes and unmount retire pending continuations. Denial or
camera failure retains manual input and offers settings/retry. Torch is an explicit
CameraView control. A short Android vibration follows successful local routing.

Resource reads use the existing canonical projection writer and original
owner/session/capture context. Ovitraps pass the current physical/point/quadrant
paired-scope resolver. A bag additionally needs an unsaved current capture and a
current assignment for that same point; historical draft assignments grant nothing.
Lot reads use the existing B10 own-courier, organization, permission and paired-scope
boundary. Unknown, foreign and wrong-courier records share unavailable feedback.
Only an already authorized retired identity gets the retired state.

Opening an ovitrap/bag awaits the M08 durable draft writer and checks current
authority and exact resolved identity again before navigation. Scanner routes pin
the clicked draft UUID; generic entry latches its first loaded UUID. Pending input
flushes under that UUID before a scanner edit, and successful navigation returns
through the originating stack. Failed origin reads retain a local retry action.
Bag QR mapping uses the current assignment while preserving the draft's original
assignment. Scanner reads create no event or stock movement.
Existing M08 Save and M02 outbox own capture/retry; there is no new migration, queue,
API or dependency. Storage failures produce no successful destination or delivery
claim. P12 re-reads authority on sync/session changes and clears stale detail while
loading. Reporting opens the existing P23 incident flow; it does not manufacture a
supply incident link or auto-submit a report.

## Current producer limits and design deviations

- `release-device` and `sample` parse correctly but have no mobile projection or
  destination screen on master. They remain unavailable until [#139](https://github.com/88randy/wolbachia/issues/139)
  supplies those contracts/screens. No placeholder release/capture authority is inferred.
- Supplies1 exposes lot/unit UUIDs, declared plan quantities and original assignment
  pins. It has no lot human code, unit/supply label or expiry. P12 shows those actual
  references and an explicit missing-metadata notice. It never says expiry does not
  apply, invents stock/remaining quantities, or converts packaging. Human lot entry
  is unavailable until a real code is downloaded (B10 [#107](https://github.com/88randy/wolbachia/issues/107)).
  The remaining producer/consumer metadata contract is tracked in [#332](https://github.com/88randy/wolbachia/issues/332).
- S06's foreign-courier name/code disclosure is replaced with generic unavailable
  feedback, as required by #136. P21 recovery stays inline with P11 so entered text
  and scanner context remain available. The scrollable native form preserves actions
  at large text sizes; full-camera visual/device qualification remains unrun.
- Bags still require the explicitly downloaded M08 assignment seam; no new bag
  bundle producer is fabricated. The production seam's existing readiness limits apply.

## Acceptance criterion to test

| Criterion | Evidence |
| --- | --- |
| Five-kind grammar, malformed/URL/version/UUID, manual exact code, wrong kind | `test/m-07.test.ts` parser and resolver matrix |
| Unknown/foreign/wrong courier, real unit/lot pins, ambiguity/retired | `test/m-07-source.test.ts` canonical SQLite resources and typed lot route |
| Duplicate callbacks and cancelled late continuations | `test/m-07.test.ts` deferred callback lease; existing `test/m-05-scanner.test.ts` permission denial/session lease used by P11 |
| Typed bag/ovitrap route, manual provenance, no routing event/inventory mutation | `test/m-07-wiring.test.ts` real M08 writer and canonical local projections |
| Local save/restart/retry original UUID once; failed write has no destination | `test/m-07-wiring.test.ts` cold service recreation, existing outbox and scripted sync |
| Localized named manual controls, large targets and truthful P12 metadata across both themes at 130% host scale | `test/m-07-ui.test.ts` actual component host-prop matrix; no native rendering claim |
| TalkBack, 130% text, light/dark and es-MX/en native journey | UNRUN; Node host checks cannot qualify native layout or hardware |

The cold-service test uses the production SQLite schema in Node; it does not prove
native SQLCipher force-stop disk behavior or a real-API journey. Camera/torch,
permission/settings, TalkBack, screenshots, real uploads/API and both MO01 device
profiles remain unrun under [#130](https://github.com/88randy/wolbachia/issues/130).
No phone installation or deployment is authorized by this feature.

Native interfaces were checked against installed Expo Camera58.0.14 and React
Native0.88.1 types and official [Camera documentation](https://docs.expo.dev/versions/latest/sdk/camera/),
[Linking.openSettings](https://reactnative.dev/docs/linking#opensettings) and
[Vibration](https://reactnative.dev/docs/vibration). Hardware performance is not certified.
