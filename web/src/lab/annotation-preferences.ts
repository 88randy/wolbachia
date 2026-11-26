import { ANNOTATION_COLORS, type AnnotationColor } from "./annotation-colors";

export const DEFAULT_ANNOTATION_GRID_SIZE = 310;
export const MIN_ANNOTATION_GRID_SIZE = 50;
export const MAX_ANNOTATION_GRID_SIZE = 1000;
export const ANNOTATION_GRID_STEP = 10;
export const MAX_DEFAULT_BOX_SIZE = 200;
const PREFERENCE_VERSION = 1;

export interface AnnotationPreferences {
  defaultBox: { width: number; height: number };
  color: AnnotationColor;
  gridSize: number;
}

function defaultPreferences(): AnnotationPreferences {
  return {
    defaultBox: { width: 12, height: 24 },
    color: "action",
    gridSize: DEFAULT_ANNOTATION_GRID_SIZE,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBoxDimension(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_DEFAULT_BOX_SIZE
  );
}

function isGridSize(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_ANNOTATION_GRID_SIZE &&
    value <= MAX_ANNOTATION_GRID_SIZE &&
    value % ANNOTATION_GRID_STEP === 0
  );
}

function parsePreferences(value: unknown): AnnotationPreferences {
  const defaults = defaultPreferences();
  if (!isRecord(value) || value.version !== PREFERENCE_VERSION) return defaults;
  const size = isRecord(value.defaultBox) ? value.defaultBox : {};
  const color =
    typeof value.color === "string" && Object.hasOwn(ANNOTATION_COLORS, value.color)
      ? (value.color as AnnotationColor)
      : defaults.color;
  return {
    defaultBox: {
      width: isBoxDimension(size.width) ? size.width : defaults.defaultBox.width,
      height: isBoxDimension(size.height) ? size.height : defaults.defaultBox.height,
    },
    color,
    gridSize: isGridSize(value.gridSize) ? value.gridSize : defaults.gridSize,
  };
}

/** Only authored display preferences are read; photos and marks belong to the draft store. */
export function readAnnotationPreferences(userId: string): AnnotationPreferences {
  try {
    const raw = localStorage.getItem("aedesvision:annotation-preferences:" + userId);
    return raw ? parsePreferences(JSON.parse(raw) as unknown) : defaultPreferences();
  } catch (error) {
    console.warn("Unable to read annotation preferences", error);
    return defaultPreferences();
  }
}

export function writeAnnotationPreferences(
  userId: string,
  preferences: AnnotationPreferences,
): void {
  try {
    localStorage.setItem(
      "aedesvision:annotation-preferences:" + userId,
      JSON.stringify({
        version: PREFERENCE_VERSION,
        defaultBox: { width: preferences.defaultBox.width, height: preferences.defaultBox.height },
        color: preferences.color,
        gridSize: preferences.gridSize,
      }),
    );
  } catch (error) {
    console.warn("Unable to save annotation preferences", error);
  }
}

/** The tips acknowledgement is an authored preference, scoped to the user on this browser. */
export function hasSeenAnnotationTips(userId: string) {
  try {
    return localStorage.getItem("aedesvision:annotation-tips:" + userId) === "seen";
  } catch (error) {
    console.warn("Unable to read annotation tips preference", error);
    return false;
  }
}
export function rememberAnnotationTips(userId: string) {
  try {
    localStorage.setItem("aedesvision:annotation-tips:" + userId, "seen");
  } catch (error) {
    console.warn("Unable to save annotation tips preference", error);
  }
}
