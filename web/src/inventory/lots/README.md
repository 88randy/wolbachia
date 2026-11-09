# Lots (W9–W10)

Lists send expiry dates/instants, blocker reasons, status, ordering and pagination
to the server. Display status, missing fields and blockers come from the returned
Lot and are refreshed after saves. An incomplete draft is usable without claiming
admission or dispatch.

Create selects a real center and action-scoped Location (or explicit center-only
draft). The payload never includes quadrant_id. Update placement uses only the
Lot UUID; its server-owned pair is immutable. Admission preserves the original
location and quantity. Retained location text comes from Lot.location_version,
which is authorized by lot.read independently of location.read.

Lot.protocol_id may be null despite nested supply configuration. Ordinary edits
retain the exact supply/protocol pins; confirmation of current configuration
pins the displayed SupplyTypeVersion and exactly its protocol or null when confirmation opens. A refresh while that dialog is open never substitutes another pair.
Current supply lookup failure cannot silently change a pin.

409 review, uncertain-delivery reconciliation and Retry-After are manual actions. The exact command is copied before awaiting delivery; reconciliation compares sent fields and the original CAS, preserving later changes to fields that were not sent.
Inputs and reviewed revisions survive permitted same-user/org reauthentication;
there is no automatic POST/PATCH replay. Dispatch requirements are explanatory;
custody and dispatch writers are owned by #106/#107.

The parent README records the criterion-to-test map.

Explicit custody_location reads (#293) are readonly before edit/action hydration,
regardless of the aggregate lot.update permission. The returned safety location
must match; unavailable custody never falls back to admission or retires a
separate admission draft. Original quantity/location/protocol pins remain
qualified admission facts, and null protocol never inherits a supply default.
The private inventory provider retains the original immutable attempt through
custody navigation; fresh original action authorization is required on return.
An observed response only applies to its same retained command, while stale view
callbacks cannot overwrite later intent. See the parent README for the exact
query and lifecycle fences; this adds no condition consumer or transfer writer.
