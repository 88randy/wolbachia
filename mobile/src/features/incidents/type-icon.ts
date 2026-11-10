import { Bike, Dog, DoorClosed, Ellipsis, Siren, TriangleAlert } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import type { Schemas } from "@wolbachia/api-client";

const KEYWORDS: readonly { readonly pattern: RegExp; readonly icon: LucideIcon }[] = [
  { pattern: /perr|can[ií]n|dog/i, icon: Dog },
  { pattern: /acceso|negad|puerta|entrar|access/i, icon: DoorClosed },
  { pattern: /moto|bike|vehic/i, icon: Bike },
  { pattern: /accident|choque|ca[ií]da|crash/i, icon: Siren },
];

/**
 * Icon of an incident category. The catalog comes from the server and has no icon field, so the
 * icon is picked from the label; anything unknown gets a neutral warning triangle.
 */
export function incidentTypeIcon(type: Schemas["IncidentType"]): LucideIcon {
  if (type.is_other) return Ellipsis;
  return KEYWORDS.find(({ pattern }) => pattern.test(type.label))?.icon ?? TriangleAlert;
}
