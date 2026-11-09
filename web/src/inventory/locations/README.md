# Locations (W11)

Location writes use WGS84 longitude/latitude, an explicitly selected center/pair,
the real responsible Membership and nullable insecticide-free configuration.
Empty or whitespace coordinates fail before numeric conversion. On update,
placement is immutable and owner options use only the saved Location identity.

The owner chooser is paginated/searchable and uses location.create on the selected
pair or location.update on the saved target. It does not enumerate broad
memberships, require role.read or use the session User UUID as owner.

Stock is an aggregate; movements are actual signed ledger legs. A stock number
links to the server-filtered lot/piece/unit ledger, and source operation links add
the actual operation UUID. Admission/source identity, movement identity and unit
version remain separate returned provenance. No operation-history endpoint or
stock writer is invented.

The map receives the same accepted table page, with symbol and text for storage
safety. It shares the existing MapLibre worker/source policy and falls back to
coordinates and the usable list. It never fetches the full location catalog.

The parent README identifies tests for scope, links, geometry reconciliation,
map parity and browser accessibility.

#293 carries the real enclosing location UUID into stock/ledger lot links as
custody_location. Movement cells label admission/transfer dispatch/transfer
receipt/transfer resolution and generic unknown sources, preserving all actual
identities. A redacted source_transfer remains null and triggers no lookup.
The direct exact lot_code movement filter delivered by #292 works when stock is
zero without resolving current lot metadata. Existing UUID/operation/piece/unit
facets remain intersecting server filters; no manual UUID input or client scan
is introduced. The history filter composition retains the shared ordering selector
alongside its editable human-code control and removable linked-UUID chips. Sorting
preserves the current operation, lot and location metadata in both the URL and
server request. Context metadata survives tabs and clear filters. Historical rows
remain available independently of current positive-custody lot metadata, subject
to the backend's current location/lot authority.
