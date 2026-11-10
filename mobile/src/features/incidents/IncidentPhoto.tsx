import { Image, View } from "react-native";
import { useState } from "react";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";

export function IncidentPhoto({ fileRef }: { readonly fileRef: string }) {
  const t = useT();
  const [hasFailed, setFailed] = useState(false);
  return (
    <View className="gap-2">
      <View className="overflow-hidden rounded-card bg-surface-muted">
        <Image
          source={{ uri: fileRef }}
          className="aspect-square w-full"
          resizeMode="contain"
          accessible
          accessibilityLabel={t("mobile.incidents.photoPreview")}
          onError={() => {
            setFailed(true);
          }}
        />
      </View>
      {hasFailed ? (
        <InfoNotice tone="warning" message={t("mobile.incidents.previewUnavailable")} />
      ) : null}
    </View>
  );
}
