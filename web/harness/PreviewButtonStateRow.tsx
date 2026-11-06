import { useTranslation } from "react-i18next";
import type { PreviewButtonState, PreviewButtonVariant } from "./preview-button-options";
import { BUTTON_SIZES } from "./preview-button-options";
import { PreviewButtonSample } from "./PreviewButtonSample";
interface PreviewButtonStateRowProps {
  entry: PreviewButtonVariant;
  state: PreviewButtonState;
}
export function PreviewButtonStateRow({ entry, state }: PreviewButtonStateRowProps) {
  const { t } = useTranslation();
  return (
    <tr>
      <th scope="row">{t(`refresh.buttons.${state}`)}</th>
      {BUTTON_SIZES.map(({ value }) => (
        <td key={value}>
          <PreviewButtonSample entry={entry} state={state} size={value} />
        </td>
      ))}
    </tr>
  );
}
