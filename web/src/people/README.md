# People workflows (#148)

`/people` links independently authorized W50 trainings and W51 evaluations.
Both consume the generated B03 contract. Operational `training.read` never
grants private evaluation, certification proof or HR notice access.

See [trainings](trainings/README.md) and [evaluations](evaluations/README.md).
All drafts remain in RAM, as required by #148. Session controller decision 92
owns identity; authorization and active-center entries retire scoped reads and
fence late command publication, including ABA changes. Identity-owned RAM input
survives while its original context remains allowed; denied contexts and lost
action grants retire private drafts. Same-identity reauthentication retains input.

No new dependency, backend contract, generated client or operational grant is
introduced. Existing versions and primitives were checked against the official
[TanStack Query cancellation guide](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation)
and [Radix Dialog documentation](https://www.radix-ui.com/primitives/docs/components/dialog).
Synthetic browser fixtures do not validate live backend authorization or delivery.
