import { Save, Search, Download, Ellipsis } from "lucide-react";
export const BUTTON_VARIANTS = [
  { variant: "primary", key: "primary", label: "primary", icon: Save },
  { variant: "secondary", key: "secondary", label: "secondary", icon: Search },
  { variant: "tertiary", key: "tertiary", label: "tertiary", icon: Download },
  { variant: "ghost", key: "ghost", label: "ghost", icon: Ellipsis },
] as const;
export const BUTTON_SIZES = [
  { value: "sm", label: "sizeSm" },
  { value: "md", label: "sizeMd" },
  { value: "lg", label: "sizeLg" },
  { value: "xl", label: "sizeXl" },
] as const;
export const BUTTON_STATES = ["default", "icon", "disabled", "loading"] as const;
export type PreviewButtonVariant = (typeof BUTTON_VARIANTS)[number];
export type PreviewButtonState = (typeof BUTTON_STATES)[number];
