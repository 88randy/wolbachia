import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import { ReleaseChoiceOption } from "./ReleaseChoiceOption.tsx";

interface Props {
  readonly kind: "task" | "device";
  readonly options: readonly { readonly id: string; readonly code: string }[];
  readonly selectedId: string | null;
  readonly disabled: boolean;
  readonly onSelect: (id: string) => void;
}
/** Options are exact downloaded identities; a printed code never substitutes for a source binding. */
export function ReleaseChoiceList(props: Props) {
  const t = useT();
  return (
    <Card>
      <AppText variant="button">{t(`mobile.release.choose.${props.kind}`)}</AppText>
      {props.options.length ? (
        props.options.map((option) => (
          <ReleaseChoiceOption
            key={option.id}
            option={option}
            disabled={props.disabled}
            isSelected={props.selectedId === option.id}
            onSelect={props.onSelect}
          />
        ))
      ) : (
        <AppText>{t(`mobile.release.empty.${props.kind}`)}</AppText>
      )}
      <AppText variant="caption">{t("mobile.release.selectionHint")}</AppText>
    </Card>
  );
}
