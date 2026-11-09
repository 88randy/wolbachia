import type { Schemas } from "@wolbachia/api-client";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Card } from "../../ui/Card.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { ReceiptReference } from "./ReceiptReference.tsx";
import { ReceiptHistory } from "./ReceiptHistory.tsx";
import type { M05Model } from "./use-m-05.ts";

export function ReceiptSources({ model }: { readonly model: M05Model }) {
  const t = useT();
  const begin = (assignment: Schemas["SupplyBundle"], releaseId: string) => {
    void model.run(() => model.service.begin(assignment.id, releaseId));
  };
  return (
    <View>
      {model.state?.assignments.flatMap((assignment) =>
        assignment.releases.map((release) => (
          <Card key={release.id}>
            <ReceiptReference label={t("mobile.supplyReceipt.assignment")} value={assignment.id} />
            <ReceiptReference label={t("mobile.supplyReceipt.release")} value={release.id} />
            <ShiftAction
              label={t("mobile.supplyReceipt.start")}
              disabled={model.isBusy || !model.state?.ready}
              onPress={() => {
                begin(assignment, release.id);
              }}
            />
          </Card>
        )),
      )}
      <ReceiptHistory model={model} />
    </View>
  );
}
