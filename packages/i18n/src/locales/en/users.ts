/** English messages of the `users` area: exactly the keys of `../es-MX/users.ts`. */
import type { users as source } from "../es-MX/users.ts";

export const users: Record<keyof typeof source, string> = {
  "users.page.title": "Users",
  "users.page.description":
    "The people who work in your organization, their profile, center and whether they are active.",
  "users.page.retention": "People who leave are never deleted: they stay in the history.",
  "users.table.caption": "Organization users",
  "users.hub.description": "People, profiles, protected RFC and sign-out on lost phones.",
  "users.hub.notifications": "Notices you receive",
  "users.hub.notificationsDescription":
    "Choose which notices reach you in the platform and by email.",

  "users.filter.search": "Search by name, email or phone",
  "users.filter.status": "Status",
  "users.status.active": "Active",
  "users.status.inactive": "Left",

  "users.column.name": "Name",
  "users.column.profiles": "Profiles",
  "users.column.center": "Center",
  "users.column.rfc": "RFC",
  "users.column.status": "Status",

  "users.rfc.hidden": "RFC hidden",
  "users.rfc.mask": "XXXX •••••• •••",
  "users.rfc.none": "No RFC",
  "users.rfc.show": "Show",
  "users.rfc.hide": "Hide",
  "users.rfc.logged": "You showed the RFC. It was recorded in the access log.",
  "users.rfc.failed": "The RFC could not be shown. Try again.",

  "users.record.data": "Details",
  "users.record.summary": "Summary",
  "users.record.email": "Work email",
  "users.record.phone": "Work phone",
  "users.record.privacy": "No resident data is stored anywhere in the platform.",

  "users.revoke.action": "Sign out on their phone",
  "users.revoke.title": "Sign {name} out on their phone?",
  "users.revoke.consequence":
    "They will have to sign in again. Anything waiting to be sent is kept and arrives when the phone connects.",
  "users.revoke.confirm": "Sign out",
  "users.revoke.done": "{name} was signed out on their phone.",
  "users.revoke.failed": "The sign-out did not work. Try again.",
  "users.revoke.help":
    "Sign out on their phone is for a lost phone: the session ends at the next contact and anything waiting to be sent is kept.",
};
