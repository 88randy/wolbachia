import { useState } from "react";

import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../AppText.tsx";
import { Button } from "../Button.tsx";
import { Card } from "../Card.tsx";
import { Notice } from "../Notice.tsx";
import { TextField } from "../TextField.tsx";

export function PreviewFields() {
  const t = useT();
  const [code, setCode] = useState("");
  const [odometer, setOdometer] = useState("");
  return (
    <Card>
      <AppText variant="h2">{t("mobile.preview.fields")}</AppText>
      <AppText variant="label">{t("mobile.preview.code")}</AppText>
      <TextField label={t("mobile.preview.code")} value={code} onChangeText={setCode} isMonospace />
      <AppText variant="label">{t("mobile.shiftOpen.odometerKm")}</AppText>
      <TextField
        label={t("mobile.shiftOpen.odometerKm")}
        value={odometer}
        onChangeText={setOdometer}
        keyboardType="number-pad"
      />
      <Notice tone="info" icon="phone" message={t("mobile.preview.disabledHint")} />
      <Button disabled label={t("mobile.preview.disabled")} onPress={() => undefined} />
    </Card>
  );
}
