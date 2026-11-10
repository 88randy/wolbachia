import type { MessageKey } from "@wolbachia/i18n";
import { NEW_ORGANIZATION_SEGMENT } from "../platform-queries";
import type { ProvisionBody } from "../platform-queries";
import { defaultTimezone } from "./timezones";

export type Delivery = "password" | "invite";
export type Language = "es-MX" | "en";

export interface CenterDraft {
  key: number;
  code: string;
  name: string;
}

export interface OrganizationDraft {
  name: string;
  slug: string;
  isSlugEdited: boolean;
  country: string;
  timezone: string;
  epiWeek: "iso" | "mmwr";
  languages: Language[];
  centers: CenterDraft[];
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  delivery: Delivery;
}

export type DraftErrors = Partial<Record<string, MessageKey>>;

export const STEP_COUNT = 5;
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const CENTER_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/;
const USERNAME_PATTERN = /^[\w.@+-]{1,150}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_MAX = 64;

export function initialDraft(): OrganizationDraft {
  return {
    name: "",
    slug: "",
    isSlugEdited: false,
    country: "MX",
    timezone: defaultTimezone("MX"),
    epiWeek: "iso",
    languages: ["es-MX"],
    centers: [{ key: 1, code: "", name: "" }],
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    delivery: "password",
  };
}

/** "Programa Mérida Norte" -> "programa-merida-norte". */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

const required = (value: string) => value.trim() === "";

function dataErrors(draft: OrganizationDraft, errors: DraftErrors): void {
  if (required(draft.name)) errors["name"] = "platform.field.required";
  if (required(draft.slug)) errors["slug"] = "platform.field.required";
  else if (!SLUG_PATTERN.test(draft.slug) || draft.slug === NEW_ORGANIZATION_SEGMENT)
    errors["slug"] = "platform.field.slugInvalid";
}

function regionErrors(draft: OrganizationDraft, errors: DraftErrors): void {
  if (required(draft.timezone)) errors["timezone"] = "platform.field.required";
  if (draft.languages.length === 0) errors["languages"] = "platform.field.languagesHint";
}

function centerErrors(draft: OrganizationDraft, errors: DraftErrors): void {
  const codes = new Set<string>();
  draft.centers.forEach((center) => {
    const prefix = `center-${String(center.key)}`;
    if (!CENTER_CODE_PATTERN.test(center.code))
      errors[`${prefix}-code`] = "platform.field.required";
    if (required(center.name)) errors[`${prefix}-name`] = "platform.field.required";
    const code = center.code.toLowerCase();
    if (code && codes.has(code)) errors["centers"] = "platform.centers.duplicate";
    codes.add(code);
  });
}

function adminErrors(draft: OrganizationDraft, errors: DraftErrors): void {
  if (required(draft.firstName)) errors["firstName"] = "platform.field.required";
  if (required(draft.lastName)) errors["lastName"] = "platform.field.required";
  if (!USERNAME_PATTERN.test(draft.username)) errors["username"] = "platform.field.required";
  if (!EMAIL_PATTERN.test(draft.email)) errors["email"] = "platform.field.invalidEmail";
}

const STEP_VALIDATORS: Readonly<
  Record<number, (draft: OrganizationDraft, errors: DraftErrors) => void>
> = { 1: dataErrors, 2: regionErrors, 3: centerErrors, 4: adminErrors };

/** Errors of one step (1-based), as catalog keys by field name. */
export function validateStep(step: number, draft: OrganizationDraft): DraftErrors {
  const errors: DraftErrors = {};
  STEP_VALIDATORS[step]?.(draft, errors);
  return errors;
}

export function toProvisionBody(draft: OrganizationDraft): ProvisionBody {
  return {
    name: draft.name.trim(),
    slug: draft.slug,
    country: draft.country,
    timezone: draft.timezone,
    epi_week: draft.epiWeek,
    languages: draft.languages,
    centers: draft.centers.map((center) => ({
      code: center.code.trim(),
      name: center.name.trim(),
    })),
    admin_first_name: draft.firstName.trim(),
    admin_last_name: draft.lastName.trim(),
    admin_username: draft.username.trim(),
    admin_email: draft.email.trim(),
    admin_delivery: draft.delivery,
  };
}

/** The step where a server field error belongs, and its catalog key. */
export function stepOfServerField(
  field: string,
  code: string,
): { step: number; key: MessageKey; field: string } {
  if (field === "slug")
    return {
      step: 1,
      field: "slug",
      key: code === "slug_taken" ? "platform.field.slugTaken" : "platform.field.slugInvalid",
    };
  if (field === "name") return { step: 1, field, key: "platform.field.required" };
  if (["country", "timezone", "epi_week", "languages"].includes(field))
    return {
      step: 2,
      field: field === "languages" ? "languages" : "timezone",
      key: "platform.field.required",
    };
  if (field.startsWith("centers"))
    return { step: 3, field: "centers", key: "platform.centers.duplicate" };
  if (field === "admin_username")
    return {
      step: 4,
      field: "username",
      key: code === "username_taken" ? "platform.field.usernameTaken" : "platform.field.required",
    };
  if (field === "admin_email")
    return { step: 4, field: "email", key: "platform.field.invalidEmail" };
  return { step: 4, field: "firstName", key: "platform.field.required" };
}
