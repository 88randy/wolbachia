import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { Card } from "../../ui/Card.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { TextField } from "../../ui/TextField.tsx";
import type { ReceiptDraft } from "./receipt-types.ts";
import { createReceiptStyles } from "./styles.ts";
import { ReceiptReference } from "./ReceiptReference.tsx";

interface Props {
  readonly line: ReceiptDraft["lines"][number];
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
}
export function ReceiptLine({ line, disabled, onChange }: Props) {
  const t = useT();
  const styles = useStyles(createReceiptStyles);
  return (
    <Card>
      <View style={styles.group}>
        <ReceiptReference label={t("mobile.supplyReceipt.lot")} value={line.lotId} />
        {line.pieceId ? (
          <ReceiptReference label={t("mobile.supplyReceipt.piece")} value={line.pieceId} />
        ) : null}
        <ReceiptReference label={t("mobile.supplyReceipt.unit")} value={line.unitVersionId} />
        <ReceiptReference label={t("mobile.supplyReceipt.expected")} value={line.expected} />
        <AppText>{t("mobile.supplyReceipt.actual")}</AppText>
        <TextField
          label={t("mobile.supplyReceipt.actual")}
          value={line.quantity}
          keyboardType="decimal-pad"
          editable={!disabled}
          accessibilityState={{ disabled }}
          onChangeText={onChange}
        />
      </View>
    </Card>
  );
}
