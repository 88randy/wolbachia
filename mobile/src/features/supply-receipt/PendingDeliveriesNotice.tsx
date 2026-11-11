import { Package } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { usePendingDeliveries } from "./use-pending-deliveries.ts";

/** Home: "Tienes material por recibir (N)" with a button to the receipt. */
export function PendingDeliveriesNotice() {
  const t = useT();
  const { push } = useNavigation();
  const count = usePendingDeliveries();
  if (count === 0) return null;
  return (
    <InfoNotice
      tone="warning"
      icon={Package}
      message={t("field.receipt.pendingHome", { count })}
      action={{
        label: t("field.receipt.pendingAction"),
        onPress: () => {
          push({ name: "supplyReceipt" });
        },
      }}
    />
  );
}
