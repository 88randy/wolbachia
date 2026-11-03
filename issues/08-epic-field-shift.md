TITLE: [Epic] Field shift: open, day view, map, close (P3–P10, P26–P27)
LABELS: epic,mobile,backend

## 1. Context
Shift ("jornada") frames all field work: bike, km, fuel, supplies, location use.
## 2. Goal
Deliver open shift, day list/map and close shift with reconciliation.
## 3. Scope / Out of scope
Child issues: P3 home without shift; P4–P7 bike + checklist + km + map download; P8 receive supplies; P9 day view; P10 offline map; P26–P27 close with reconciliation. Out: route optimization.
## 4. Data model
Shift, Bike, BikeCheck, SupplyAssignment, SupplyReceipt, Reconciliation (all OrgScoped).
## 5. Contract
Events: shift.open, supplies.receive, shift.close, supplies.reconcile.
## 6. Behavior
Per design canvas boards S02–S05, S12 and prototypes R1, R7.
## 7. Edge cases & errors
Grave bike fault blocks that bike; unjustified difference does not block closing (becomes discrepancy).
## 8. Acceptance criteria
- [ ] Prototype routes R1 and R7 reproducible on device.
## Notes
Split into child issues before starting.
