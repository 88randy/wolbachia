/** English messages of the `auth` area: exactly the keys of `../es-MX/auth.ts`. */
import type { auth as source } from "../es-MX/auth.ts";

export const auth: Record<keyof typeof source, string> = {
  // Web sign-in (W1), password reset, organization choice and session expiry (#28)
  "auth.login.title": "Sign in",
  "auth.login.username": "Username",
  "auth.login.password": "Password",
  "auth.login.showPassword": "Show password",
  "auth.login.submit": "Sign in",
  "auth.login.submitting": "Signing in…",
  "auth.login.forgot": "I forgot my password",
  "auth.login.noSignUp": "Accounts are created by your organization's administrator.",
  "auth.login.usernameRequired": "Enter your username.",
  "auth.login.passwordRequired": "Enter your password.",
  "auth.login.invalidCredentials": "The username or password doesn't match.",
  "auth.login.invalidCredentialsHint": "Check them and try again.",
  "auth.login.noMembership":
    "Your account has no active access to an organization. Contact your administrator.",
  "auth.login.passwordChanged": "Your password was updated. Sign in with the new one.",
  "auth.login.program": "Aedes control with Wolbachia",
  "auth.login.headline": "Entomological operations and surveillance platform",
  "auth.login.tagline":
    "This is where the office prepares, controls and analyzes what happens in the field.",
  "auth.login.standards": "NOM-032-SSA2-2014 · CENAPRECE Guides 2024",
  "auth.lockout.message": "Too many attempts. Wait {minutes} min and try again.",
  "auth.lockout.noWait": "Too many attempts. Wait a few minutes and try again.",
  "auth.lockout.hint":
    "If you forgot your password, you can reset it from the link below or ask your administrator for help.",
  "auth.forgot.title": "Reset your password",
  "auth.forgot.body":
    "Enter your account's email and we will send you a link to choose a new password.",
  "auth.forgot.email": "Email address",
  "auth.forgot.emailInvalid": "Enter a valid email, for example name@company.com.",
  "auth.forgot.submit": "Send link",
  "auth.forgot.sentTitle": "Check your email",
  "auth.forgot.sent":
    "If that email is registered, we sent you a link to reset your password. It can take a few minutes; check your spam folder too.",
  "auth.forgot.backToLogin": "Back to sign in",
  "auth.reset.title": "Choose a new password",
  "auth.reset.newPassword": "New password",
  "auth.reset.confirmPassword": "Confirm the password",
  "auth.reset.hint": "Use a long password that is not easy to guess.",
  "auth.reset.submit": "Save password",
  "auth.reset.required": "Enter a password.",
  "auth.reset.mismatch": "The passwords don't match.",
  "auth.reset.passwordTooShort": "The password is too short. Use a longer one.",
  "auth.reset.passwordTooCommon": "That password is too common. Choose another one.",
  "auth.reset.passwordEntirelyNumeric": "The password can't be only numbers.",
  "auth.reset.passwordTooSimilar":
    "The password is too similar to your details. Choose another one.",
  "auth.reset.invalidLinkTitle": "This link no longer works",
  "auth.reset.invalidLinkBody":
    "The link expired, was already used or is not valid. Request a new one to continue.",
  "auth.reset.requestNew": "Request a new link",
  "auth.organization.title": "Choose your organization",
  "auth.organization.body":
    "Your account belongs to several organizations. Choose which one you want to work with now.",
  "auth.organization.legend": "Available organizations",
  "auth.organization.submit": "Continue",
  "auth.session.title": "Your session ended",
  "auth.session.body":
    "For security we ended your session. Enter your password to continue; what you had not saved is kept.",
  "auth.session.submit": "Continue",
  "auth.session.signOut": "Sign out",
};
