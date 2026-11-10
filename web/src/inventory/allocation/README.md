# Courier allocation, reconciliation and write-offs (W15-W17, W39, #153)

Routes: `/inventory/assignments` (W15), `/inventory/reconciliations` (W16),
`/inventory/write-offs` (W17) and `/lab/write-offs` (W39). Permissions come from
`GET /me/`: `inventory.allocate`, `inventory.reconcile`, `inventory.write_off` and
`bag.dispose` (W39). Forbidden controls are hidden, a missing center scope shows a
denial and no request is sent. Every screen remounts when the session/scope context
changes, so old results and drafts are dropped.

## Contract (B-10, generated client only)

- Reads: `/courier-assignments/suggestion/`, `/courier-assignments/`, `/reconciliations/`,
  `/write-offs/`; lists page, filter (`date`, `kind`) and order on the server through the URL.
- Writes are two idempotent steps: `POST /inventory-intents/` (declares evidence, carries the
  `command_id` and `expected_revision`), then the execute endpoint with `intent_id`
  (`/reconciliations/{id}/justify/`, `/courier-assignments/{id}/release/`, `/write-offs/`).
  `POST /courier-assignments/` is direct. The first command is frozen: only the explicit retry
  resends it; a confirmed rejection (409, 400...) releases it and the form keeps what was typed.
  Reauthentication never replays a write.
- W17 and W39 are the same `WriteOffForm`. A biological Lot or any Bag disposal needs a
  server-verified RPBI upload (B-04, reusing `TransferEvidence`); the submit stays disabled and
  names the blocker until it exists.
- The reconciliation equation is computed by the backend; the client only classifies it
  (`pending` = no signed receipt, never zero; `balanced`; `difference`) with sign, icon and text.

## Known limits (assumptions)

- The signature state is read from the signed receipt credit of the reconciliation frame, so it
  needs `inventory.reconcile`; otherwise it is shown as unavailable. The contract has no explicit
  "sent" state: "sent" only means a release succeeded in this session.
- Piece-identified lots cannot be allocated or written off here (piece selection is not exposed).
- Write-off rows carry no void lifecycle in the contract, so no voided state is rendered.
- Reasons use the organization's void-reason catalog (the backend resolves them there).
- RPBI evidence accepts the same PNG/JPEG images as transfer evidence.
