import { useEffect, useState } from "react";
import {
  readAnnotationPreferences,
  writeAnnotationPreferences,
  type AnnotationPreferences,
} from "./annotation-preferences";

/** Identity changes replace the whole preference state before it can be displayed or persisted. */
export function useAnnotationPreferences(userId: string) {
  const [state, setState] = useState(() => ({
    userId,
    preferences: readAnnotationPreferences(userId),
  }));
  if (state.userId !== userId) setState({ userId, preferences: readAnnotationPreferences(userId) });
  useEffect(() => {
    if (state.userId === userId) writeAnnotationPreferences(userId, state.preferences);
  }, [state, userId]);
  const setPreference = <Key extends keyof AnnotationPreferences>(
    key: Key,
    value: AnnotationPreferences[Key],
  ) => {
    setState((current) => ({ ...current, preferences: { ...current.preferences, [key]: value } }));
  };
  return {
    ...state.preferences,
    setDefaultBox: (size: AnnotationPreferences["defaultBox"]) => {
      setPreference("defaultBox", size);
    },
    setColor: (color: AnnotationPreferences["color"]) => {
      setPreference("color", color);
    },
    setGridSize: (size: number) => {
      setPreference("gridSize", size);
    },
  };
}
