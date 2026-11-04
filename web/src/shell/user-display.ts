import type { Locale } from "@wolbachia/i18n";
import type { Me } from "../session/me";

type MeUser = Me["user"];
type MeProfile = Me["profiles"][number];

const MAX_INITIALS = 2;

/** "Ana Pérez", or the username when the account has no name. */
export function displayNameOf(user: MeUser): string {
  const fullName = `${user.first_name} ${user.last_name}`.trim();
  return fullName === "" ? user.username : fullName;
}

/** Up to two capital letters for the avatar: first letters of the name, or of the username. */
export function initialsOf(user: MeUser): string {
  const words = displayNameOf(user)
    .split(/[\s._-]+/)
    .filter((word) => word !== "");
  return words
    .slice(0, MAX_INITIALS)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

/** The profile's label in the UI language; a blank English label falls back to the Spanish one. */
export function profileLabelOf(profile: MeProfile, language: Locale): string {
  if (language === "en" && profile.label_en.trim() !== "") return profile.label_en;
  return profile.label_es;
}
