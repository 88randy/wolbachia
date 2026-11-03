TITLE: [Epic] Ovitraps: scan, place, check, replace, relocate, remove (P11–P17, P21)
LABELS: epic,mobile,backend
## 1. Context
Core daily work (~40 checks/day). QR decides the screen.
## 2. Goal
Implement QR routing and all trap flows offline.
## 3. Scope / Out of scope
Child issues per screen. Out: egg counting (web).
## 4. Data model
SamplingPoint (folio), Trap, TrapReading (finding, has_eggs, temp, humidity, bag_code, paddle_type, is_lagged), PlacementAttempt, RelocationProposal.
## 5. Contract
Events: trap.place, trap.check, trap.replace, trap.relocate, trap.remove.
## 6. Behavior
Per boards S06–S09 and prototypes R2–R4. Lagged reading rule, 50 m rules, relocation thresholds from RuleSet.
## 7. Edge cases & errors
Trap of another worker, removed trap found (abandoned incident), already checked this week (void and correct).
## 8. Acceptance criteria
- [ ] Normal check is the shortest path in the app (measure taps).
## Notes
Depends on #design egg Yes/No.
