TITLE: [Epic] Fixed actions and system: fuel, incidents, emergency, community, history, trainings, settings, speed lock (P22–P25, P29–P32)
LABELS: epic,mobile,backend
## 1. Context
Bottom bar actions and system screens available during the shift.
## 2. Goal
Implement per boards S11, S13, S14 and prototype R6.
## 3. Scope / Out of scope
Includes speed lock overlay and global states. Out: supervisor views.
## 4. Data model
FuelLoad, Incident (+comments), CommunityActivity, Accident.
## 5. Contract
Events: fuel.load, incident.report, emergency.accident, community.activity.
## 6. Behavior
Every open list ends with "Otro (especificar)".
## 7. Edge cases & errors
Speed lock never loses half-filled forms.
## 8. Acceptance criteria
- [ ] Incident saved offline appears as sent in inbox after reconnect (R6).
## Notes
—
