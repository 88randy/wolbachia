import { Check } from "lucide-react-native";
import { Pressable, View } from "react-native";
import type { Schemas } from "@wolbachia/api-client";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useTheme } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { SectionTitle } from "../../ui/SectionTitle.tsx";
import { KIT_ICON_STROKE } from "../../ui/kit-styles.ts";
import { incidentTypeIcon } from "./type-icon.ts";
import { useTypePicker } from "./use-type-picker.ts";
import type { M12Model } from "./use-m-12.ts";

interface TileProps {
  readonly type: Schemas["IncidentType"];
  readonly isSelected: boolean;
  readonly disabled: boolean;
  readonly onChoose: (id: string) => void;
}

function TypeTile({ type, isSelected, disabled, onChoose }: TileProps) {
  const { theme } = useTheme();
  const t = useT();
  const Icon = incidentTypeIcon(type);
  const color = isSelected ? theme.color.onAction : theme.color.action;
  const frame = isSelected ? "border-action bg-action" : "border-line bg-surface";
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={type.label}
      accessibilityState={{ checked: isSelected, disabled }}
      disabled={disabled}
      onPress={() => {
        onChoose(type.current_version_id);
      }}
      className={`min-h-28 w-[48%] items-center justify-center gap-2 rounded-card border-2 p-3 active:opacity-80 ${frame}`}
    >
      <Icon color={color} size={36} strokeWidth={KIT_ICON_STROKE} />
      <AppText variant="bodyStrong" className="text-center" style={{ color: isSelected ? color : undefined }}>
        {type.label}
      </AppText>
      {isSelected ? (
        <View className="flex-row items-center gap-1">
          <Check color={color} size={16} strokeWidth={3} />
          <AppText variant="caption" style={{ color }}>
            {t("courier.choice.selected")}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

/** What happened? Big tiles with an icon instead of a search list; "Otro" always goes last. */
export function IncidentTypePicker({ model }: { readonly model: M12Model }) {
  const t = useT();
  const picker = useTypePicker(model);
  if (!model.state?.draft) return null;
  const sorted = [...picker.types].sort((a, b) => Number(a.is_other) - Number(b.is_other));
  return (
    <>
      <SectionTitle title={t("courier.flow.incident.whatHappened")} />
      <View className="flex-row flex-wrap justify-between gap-y-3">
        {sorted.map((type) => (
          <TypeTile
            key={type.current_version_id}
            type={type}
            isSelected={type.current_version_id === picker.selected}
            disabled={picker.disabled}
            onChoose={picker.choose}
          />
        ))}
      </View>
      {sorted.length === 0 ? (
        <AppText variant="body">{t("mobile.incidents.noTypes")}</AppText>
      ) : null}
    </>
  );
}
