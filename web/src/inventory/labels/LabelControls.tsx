import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SelectMenu } from "../../ui/SelectMenu";
import { LABEL_KIND_SPECS, LABEL_SIZES } from "./label-kinds";
import type { LabelKind, LabelSize } from "./label-kinds";

interface LabelControlsProps {
  kinds: readonly LabelKind[];
  kind: LabelKind;
  onKind: (kind: LabelKind) => void;
  size: LabelSize;
  onSize: (size: LabelSize) => void;
}

function SizeSelect({ size, onSize }: Pick<LabelControlsProps, "size" | "onSize">) {
  const { t } = useTranslation();
  const options = LABEL_SIZES.map((value) => ({
    value,
    label: t(`inventory.labels.size.${value}`),
  }));
  return (
    <div className="w-56">
      <SelectMenu
        id="label-size"
        ariaLabel={t("inventory.labels.size")}
        value={size}
        options={options}
        onValueChange={(value) => {
          onSize(value as LabelSize);
        }}
      />
    </div>
  );
}

/** Label type tabs on the left, label size on the right. */
export function LabelControls({ kinds, kind, onKind, size, onSize }: LabelControlsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <Tabs
        value={kind}
        onValueChange={(value) => {
          onKind(value as LabelKind);
        }}
      >
        <TabsList aria-label={t("inventory.labels.kindTabs")}>
          {kinds.map((entry) => (
            <TabsTrigger key={entry} value={entry} className="px-3">
              {t(LABEL_KIND_SPECS[entry].labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <SizeSelect size={size} onSize={onSize} />
    </div>
  );
}
