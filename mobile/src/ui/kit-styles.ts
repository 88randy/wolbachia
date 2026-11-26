import { shadow } from "@wolbachia/tokens";
import { StyleSheet } from "react-native";

/**
 * Soft card elevation of the prototype (`0 4px 14px rgba(10,26,63,.05)` plus a 1px ring, drawn with
 * `border border-line`). NativeWind has no Android elevation utility, so the shadow lives here.
 */
export const kitShadow = StyleSheet.create({
  card: {
    shadowColor: shadow.card.color,
    shadowOffset: { width: shadow.card.offsetX, height: shadow.card.offsetY },
    shadowRadius: shadow.card.blur,
    shadowOpacity: 1,
    elevation: 2,
  },
  raised: {
    shadowColor: shadow.overlay.color,
    shadowOffset: { width: shadow.overlay.offsetX, height: shadow.overlay.offsetY },
    shadowRadius: shadow.overlay.blur,
    shadowOpacity: 1,
    elevation: 6,
  },
});

/** Minimum height of every primary/secondary/choice control (owner rule: at least 56 dp). */
export const KIT_TOUCH_HEIGHT = 56;
/** Icon size inside big controls. */
export const KIT_ICON_SIZE = 24;
/** Icon stroke used across the kit (matches the Codequim icon set). */
export const KIT_ICON_STROKE = 2.25;
