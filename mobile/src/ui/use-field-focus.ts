import { useState } from "react";
import type { TextInputProps } from "react-native";

/** Preserve caller field callbacks while exposing focus to the shared field's border. */
export function useFieldFocus(props: Pick<TextInputProps, "onFocus" | "onBlur">) {
  const [isFocused, setIsFocused] = useState(false);
  const onFocus: TextInputProps["onFocus"] = (event) => {
    setIsFocused(true);
    props.onFocus?.(event);
  };
  const onBlur: TextInputProps["onBlur"] = (event) => {
    setIsFocused(false);
    props.onBlur?.(event);
  };
  return { isFocused, onFocus, onBlur };
}
