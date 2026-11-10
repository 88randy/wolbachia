# Settings (P31)

Preferences are local UI choices, owned by `PreferenceStore` and namespaced by
organization/user. One writer merges rapid choices and publishes after SQLite
commit. Native font scaling stays enabled; the large-text choice adds30% to both
shared labels and text inputs. Returning to system text removes that extra scale.

`SettingsService` reads counts from existing tables without rewriting work.
`lock()` calls the authoritative credential lock, so it neither erases pending
uploads nor extends a token lifetime. The visible pending-data explanation is
available before closing access. Storage/read errors retain a usable lock action.
The bundled app version proves only the current bundle; update service state is
unavailable until #146/B29 supplies a real signed operation/receipt.

Support is the organization-configured authenticated `support_contact` string.
It is displayed as selectable text, never interpreted as an arbitrary link,
emergency number or delivery proof. No personal identifiers or secrets are added.

See `mobile/test/settings-preferences.test.ts` and `settings-journey.test.ts`.
M10 retained release drafts participate in the same pending-work count before any
event or photo exists; closing local access preserves them and their original UUID.
Native TalkBack, force-stop and real-API testing remain UNRUN.
