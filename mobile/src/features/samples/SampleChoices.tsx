import type { MessageKey } from "@wolbachia/i18n";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { SectionTitle } from "../../ui/SectionTitle.tsx";
import { SampleChoice } from "./SampleChoice.tsx";
import type { SampleChoice as Choice } from "./view-model.ts";

interface Props {
  readonly labelKey: MessageKey;
  readonly emptyKey: MessageKey;
  readonly options: readonly Choice[];
  readonly selected: string | null;
  readonly disabled: boolean;
  readonly onSelect: (id: string) => void;
}
export function SampleChoices(props: Props) {
  const t = useT();
  return (
    <>
      <SectionTitle title={t(props.labelKey)} />
      {props.options.length === 0 ? <AppText variant="body">{t(props.emptyKey)}</AppText> : null}
      {props.options.map((option) => (
        <SampleChoice
          key={option.id}
          option={option}
          isSelected={option.id === props.selected}
          disabled={props.disabled}
          onSelect={props.onSelect}
        />
      ))}
    </>
  );
}
