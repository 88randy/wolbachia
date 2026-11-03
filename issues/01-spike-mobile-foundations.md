TITLE: [Spike] Validate mobile foundations: offline store, QR, offline maps, dedicated mode, server-driven updates
LABELS: spike,mobile,priority:high

## 1. Context
The field app must work offline most of the day, on company-owned Android phones in dedicated mode, distributed outside Google Play. Several technical assumptions in the design have not been verified on real devices.

## 2. Goal
Answer, with working proof-of-concept code and a short written report, whether each assumption holds and which library/approach we adopt.

## 3. Scope / Out of scope
**In scope (one throwaway PoC app under `spikes/mobile-foundations/`):**
- Local store: compare WatermelonDB vs op-sqlite (write 10k events, query pending queue, survive app kill).
- QR scanning with react-native-vision-camera code scanner: read speed in sunlight, torch, damaged labels.
- Offline map: MapLibre React Native with OSM tiles for one quadrant downloaded as an offline pack; size and render time.
- "How to get there": open Organic Maps via `geo:` URI; behavior when it is not installed.
- Speed lock: detect > 10 km/h from GPS speed; latency to show/hide overlay.
- Dedicated mode: Android lock task / Device Owner provisioning; what internal IT needs to do per device.
- Server-driven update: install a new APK version triggered from inside the app on a Device Owner device; JS-only OTA as alternative.
**Out of scope:** production code, UI polish, backend.

## 4. Data model
N/A (PoC uses a fake `event` table: id uuid, type, payload json, device_time, status).

## 5. Contract (API / interfaces)
N/A. Deliverable: `spikes/mobile-foundations/REPORT.md`.

## 6. Behavior
Each item is tested on at least one real company phone model. Results recorded as: works / works with caveats / does not work, with evidence (video, numbers).

## 7. Edge cases & errors
- Phone reboot with pending queue.
- Storage almost full.
- GPS off / weak accuracy.
- Camera permission denied.
- Update download interrupted.

## 8. Acceptance criteria
- [ ] REPORT.md answers every in-scope item with evidence.
- [ ] Recommendation for local store library, with reasons.
- [ ] Documented procedure for internal IT: provision dedicated mode and push an update.
- [ ] `docs/decisions.md` row 6 and 7 updated.

## Notes
- Timebox: 1–2 weeks. If dedicated mode or in-app updates are not feasible, escalate before Epic "Field session" starts.
- Phone model(s) to test: **[PENDING: confirm with client]**.
