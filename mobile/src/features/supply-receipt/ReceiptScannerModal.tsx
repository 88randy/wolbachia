import { Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { ReceiptBarcodePreview } from "./ReceiptBarcodePreview.tsx";
import { createReceiptStyles } from "./styles.ts";
import type { ReceiptScannerModel } from "./use-receipt-scanner.ts";

export function ReceiptScannerModal({ scanner }: { readonly scanner: ReceiptScannerModel }) {
  const t = useT();
  const styles = useStyles(createReceiptStyles);
  return (
    <Modal visible={scanner.isVisible} onRequestClose={scanner.stop} presentationStyle="fullScreen">
      <SafeAreaView style={[styles.root, styles.content]}>
        <AppText variant="h2" accessibilityRole="header">
          {t("mobile.supplyReceipt.scannerTitle")}
        </AppText>
        <AppText>{t("mobile.supplyReceipt.scannerHint")}</AppText>
        {scanner.isVisible ? <ReceiptBarcodePreview scanner={scanner} /> : null}
        <ShiftAction label={t("mobile.supplyReceipt.stopScanner")} onPress={scanner.stop} />
      </SafeAreaView>
    </Modal>
  );
}
