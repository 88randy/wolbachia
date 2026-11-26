import { X } from "lucide-react-native";
import { Image, StyleSheet, View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";

const styles = StyleSheet.create({ thumb: { width: 96, height: 96, borderRadius: 12 } });

/** A taken photo as a small picture with its delete button. */
export function PhotoThumb({
  uri,
  number,
  disabled,
  onDelete,
}: {
  readonly uri: string;
  readonly number: number;
  readonly disabled: boolean;
  readonly onDelete: () => void;
}) {
  const t = useT();
  return (
    <View className="flex-row items-center gap-3">
      <Image
        source={{ uri }}
        style={styles.thumb}
        accessibilityLabel={t("field.capture.photoThumb", { number })}
      />
      <View className="flex-1">
        <SecondaryButton
          icon={X}
          label={t("field.lifecycle.discardPhoto", { number })}
          disabled={disabled}
          onPress={onDelete}
        />
      </View>
    </View>
  );
}
