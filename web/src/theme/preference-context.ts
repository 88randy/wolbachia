import { createContext } from "react";
import type { ThemePreference } from "./theme";
/** A dev preview may override initialization without overwriting the browser preference. */
export const ThemePreferenceContext = createContext<ThemePreference | undefined>(undefined);
