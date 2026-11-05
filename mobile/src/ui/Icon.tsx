import Svg, { Path } from "react-native-svg";

import { ICON_PATHS } from "./icon-paths.ts";
import type { IconName } from "./icon-paths.ts";

const VIEW_BOX = "0 0 24 24";
const STROKE_WIDTH = 2.25;
const DEFAULT_SIZE = 24;

interface IconProps {
  readonly name: IconName;
  readonly color: string;
  readonly size?: number;
}

/** A decorative icon: screen readers skip it, so the control around it must carry the label. */
export function Icon({ name, color, size = DEFAULT_SIZE }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={VIEW_BOX}
      fill="none"
      stroke={color}
      strokeWidth={STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Path d={ICON_PATHS[name]} />
    </Svg>
  );
}
