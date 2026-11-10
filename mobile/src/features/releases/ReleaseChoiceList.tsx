import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { SectionTitle } from "../../ui/SectionTitle.tsx";
import { ReleaseChoiceOption } from "./ReleaseChoiceOption.tsx";

interface Props {
  readonly kind: "task" | "device";
  readonly options: readonly { readonly id: string; readonly code: string }[];
  readonly selectedId: string | null;
  readonly disabled: boolean;
  readonly onSelect: (id: string) => void;
}
const CHOICE_KEYS = {
  task: { title: "mobile.release.chooseTask", empty: "mobile.release.emptyTask" },
  device: { title: "mobile.release.chooseDevice", empty: "mobile.release.emptyDevice" },
} as const;
/** Options are exact downloaded identities; a printed code never substitutes for a source binding. */
export function ReleaseChoiceList(props: Props) {
  const t = useT();
  const keys = CHOICE_KEYS[props.kind];
  return (
    <>
      <SectionTitle title={t(keys.title)} />
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
        <AppText variant="body">{t(keys.empty)}</AppText>
      )}
    </>
  );
}
