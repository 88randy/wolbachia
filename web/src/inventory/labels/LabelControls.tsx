import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LABEL_KIND_SPECS } from "../../labels/label-kinds";
import type { LabelKind } from "../../labels/label-kinds";

interface LabelControlsProps {
  kinds: readonly LabelKind[];
  kind: LabelKind;
  onKind: (kind: LabelKind) => void;
}

/** One tab per kind of label the user may print. */
export function LabelControls({ kinds, kind, onKind }: LabelControlsProps) {
  const { t } = useTranslation();
  return (
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
  );
}
