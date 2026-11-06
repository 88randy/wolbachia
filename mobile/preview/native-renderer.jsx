import { createElement } from "react";
import { StyleSheet, Text as BrowserText, TextInput as BrowserTextInput } from "react-native-web";

export * from "react-native-web";

// react-native-svg statically imports this for its Android-only touch-sound branch.
// Fail explicitly if a preview ever tries to execute native code.
export const TurboModuleRegistry = {
  getEnforcing() {
    throw new Error("Native modules cannot run in the browser renderer.");
  },
};

// Browser approximation of Android text scaling; native text layout still needs device QA.
const textScale = new URLSearchParams(window.location.search).get("scale") === "130" ? 1.3 : 1;

function scaledStyle(style) {
  const flattened = StyleSheet.flatten(style);
  return [
    style,
    { fontSize: flattened.fontSize * textScale, lineHeight: flattened.lineHeight * textScale },
  ];
}

export function Text(props) {
  return createElement(BrowserText, { ...props, style: scaledStyle(props.style) });
}

export function TextInput(props) {
  return createElement(BrowserTextInput, { ...props, style: scaledStyle(props.style) });
}
