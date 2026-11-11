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

  "users.new.action": "New user",
  "users.new.title": "New user",
  "users.new.sectionData": "Personal details",
  "users.new.sectionAccess": "Center and profile",
  "users.new.name": "Full name",
  "users.new.username": "Sign-in username",
  "users.new.email": "Work email (optional)",
  "users.new.center": "Center",
  "users.new.centerPlaceholder": "Choose a center",
  "users.new.profile": "Profile",
  "users.new.profilePlaceholder": "Choose a profile",
  "users.new.scope": "Center scope",
  "users.new.scopeAll": "All centers",
  "users.new.scopeSelected": "Only the centers I choose",
  "users.new.scopeCenters": "Centers with access",
  "users.new.scopeHint":
    "The warehouse a person can reach comes from their center scope: it is not assigned separately.",
  "users.new.required": "Fill in name, username, center and profile.",
  "users.new.scopeRequired": "Choose at least one center.",
  "users.new.submit": "Create user",
  "users.new.creating": "Creating…",
  "users.new.created": "User {name} was created.",
  "users.new.partial":
    "User {name} was created, but has no profile or scope yet and cannot work. Retry the assignment.",
  "users.new.assigned": "Profile and scope assigned.",
  "users.new.retry": "Retry assignment",
  "users.new.close": "Close",

  "users.password.action": "Generate temporary password",
  "users.password.title": "Temporary password for {name}",
  "users.password.label": "Temporary password",
  "users.password.once":
    "Shown only once. Copy it now and hand it over through a secure channel. It cannot be seen again after you close this window.",
  "users.password.expires": "Expires on {date}",
  "users.password.mustChange": "The person must change it at sign-in.",
  "users.password.copy": "Copy",
  "users.password.copied": "Password copied",
  "users.password.copyFailed": "Could not copy. Select it and copy it by hand.",
  "users.password.generate": "Generate",

  "users.action.changeScope": "Change profile and scope",
  "users.action.deactivate": "Deactivate",
  "users.action.reactivate": "Reactivate",
  "users.action.blockedInactive":
    "The user is deactivated. Reactivate them to change profile and scope or generate a password.",
  "users.deactivate.title": "Deactivate {name}?",
  "users.deactivate.consequence":
    "Their membership ends and their sessions close, including the phone. Nothing is deleted: it stays in the history.",
  "users.deactivate.confirm": "Deactivate",
  "users.deactivate.reasonLabel": "Reason for deactivation",
  "users.deactivate.reasonHint": "Required. At least {count} characters.",
  "users.record.deactivationReason": "Deactivation reason",
  "users.deactivate.done": "{name} is deactivated.",
  "users.reactivate.done": "{name} is active again.",

  "users.members.profiles": "Profiles",
  "users.members.user": "User",
  "users.members.profilesField": "Membership profiles",
  "users.members.filterProfile": "Profile",
  "users.roles.members": "Users",
  "users.roles.membersCount": "{count} active",
  "users.roles.membersLink": "See the active users of profile {name}",
  "users.roles.copy": "Copy profile",
  "users.roles.copyTitle": "Copy profile {name}",
  "users.roles.copyHint":
    "Creates a new profile with the same permissions and scope. You can edit it afterwards.",
  "users.roles.copyLabelEs": "Name in Spanish",
  "users.roles.copyLabelEn": "Name in English",
  "users.roles.copyRequired": "Enter the name in Spanish and in English.",
  "users.roles.copySubmit": "Create copy",
  "users.roles.copyDone": "New profile created.",

  "users.error.ownAdministration":
    "You cannot remove your own administration rights or deactivate yourself. Ask another administrator.",
  "users.error.ownAccount": "You cannot generate a temporary password for your own account.",
  "users.error.sharedAccount":
    "This person also signs in to another organization or platform, so their password cannot be reset here.",
  "users.error.inactive": "The user is deactivated. Reactivate them first.",
};
