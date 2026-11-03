TITLE: [Mobile] Login and unlock with PIN or fingerprint (P1–P2)
LABELS: mobile,security

## 1. Context
Design screens P1 (login) and P2 (unlock) with their states.

## 2. Goal
Implement first login (requires signal), offline unlock with PIN/biometrics, idle lock, remote revoke handling.

## 3. Scope / Out of scope
**In:** P1 states (normal, wrong credentials, no signal on first login, session closed remotely), P2 states (normal, wrong PIN, too many attempts → full password), idle timeout with 1-minute warning.
**Out:** password reset (call supervisor).

## 4. Data model
PIN hash stored in Android Keystore-backed secure storage; never sent to server.

## 5. Contract
`/api/v1/auth/login/`, `/api/v1/auth/refresh/` (#4), through `packages/api-client`.

## 6. Behavior
Lock never discards unsent data or half-filled forms.

## 7. Edge cases & errors
Clock skew detected at login → banner "La hora del teléfono no coincide".

## 8. Acceptance criteria
- [ ] All P1/P2 states from the design.
- [ ] 3 wrong PINs → requires full password.

## Notes
Attempts threshold: rule parameter (default 3, seeded in #3); confirm with client.
