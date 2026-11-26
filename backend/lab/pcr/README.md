# PCR tests at external laboratories

Additive Lab subpackage; it reuses `WolbachiaSample` and never changes the samples app.

- `ExternalLab`: per-organization catalog, editable and deactivated (never deleted).
- `PcrBatch` + `PcrBatchSample`: one batch per shipment to one lab, with targets `wolbachia`
  and/or `dengue`. Eligible samples: current `pcr.manage` scope, not voided, no valid Wolbachia
  result and not in another live batch.
- `PcrBatchEvent`: insert-only steps `ready -> ship -> receive -> results -> close`. Status is
  derived from the live steps; `undo` (with reason) reverts the last step and `void` (with reason)
  ends the batch. Neither is allowed once results exist.
- `PcrResult` (+ `PcrResultVoid`): per sample and target. A Wolbachia result is also recorded through
  `execute_sample_command` (receive first when missing), so W54 prevalence keeps one source; a valid
  Wolbachia result cannot be voided, an invalid one is repeated. Dengue results can be voided and
  re-entered. Serotype (DENV-1..4, dengue positive only) and Ct (0-60) are optional.
- `PcrReport` and the ship evidence use verified, unbound uploads (permit document pattern): PDF for
  reports; PDF, JPEG or PNG for the shipping receipt. Downloads are attachments with `no-store`.
- CSV: `results-template/` returns the batch rows; `results-preview/` parses Spanish or English
  headers/values, `;` or `,`, decimal comma, and returns per-row `{field, code, params}` errors
  without writing; the client then posts valid rows to `results/` (revalidated, all or nothing).

Permissions `pcr.read`/`pcr.manage` (entomologist, coordinator, admin). Wolbachia rows also need
`sample.result_create` (and `sample.receive` when not received) in the sample
