import type { RefObject } from "react";
import Svg, { Rect, Path } from "react-native-svg";
import { useTheme } from "../../theme/ThemeProvider.tsx";
import { SIGNATURE_WIDTH, SIGNATURE_HEIGHT } from "./signature-path.ts";
export function SignatureRaster({
  svg,
  strokes,
}: {
  readonly svg: RefObject<Svg | null>;
  readonly strokes: readonly string[];
}) {
  const { theme } = useTheme();
  return (
    <Svg
      ref={svg}
      width="100%"
      height="100%"
      viewBox={`0 0 ${String(SIGNATURE_WIDTH)} ${String(SIGNATURE_HEIGHT)}`}
    >
      <Rect width={SIGNATURE_WIDTH} height={SIGNATURE_HEIGHT} fill={theme.color.surface} />
      {strokes.filter(Boolean).map((path, index) => (
        <Path
          key={index}
          d={path}
          stroke={theme.color.text.primary}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}
