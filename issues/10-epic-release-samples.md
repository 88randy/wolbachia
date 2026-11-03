TITLE: [Epic] Wolbachia releases and samples (P18–P20)
LABELS: epic,mobile,backend
## 1. Context
Release only within a valid permit, zone, lot, training and schedule.
## 2. Goal
Offline validation with cached permits + server revalidation.
## 3. Scope / Out of scope
Release valid/blocked, GPS accuracy gate, samples. Out: permit management (web).
## 4. Data model
Permit (zone polygon, validity), ReleaseDevice, ReleaseLot, Release, Sample, TrainingCertification.
## 5. Contract
Events: release.record, sample.collect.
## 6. Behavior
Per board S10 and prototype R5. No path to release from the blocked screen.
## 7. Edge cases & errors
Offline release later invalid → inbox message without blame, supervisor notified.
## 8. Acceptance criteria
- [ ] Server rejects release with expired permit even if phone accepted it.
## Notes
Permit zone geometry source to confirm with client.
