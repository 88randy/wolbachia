import { useLocale, useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Counter } from "../../ui/Counter.tsx";
import { SectionTitle } from "../../ui/SectionTitle.tsx";
import { TextField } from "../../ui/TextField.tsx";
import { CommunityChoiceList } from "./CommunityChoiceList.tsx";
import type { CommunityModel } from "./use-community.ts";

/** One step after another on a single scroll: what, where, how many, what was agreed. */
export function CommunityForm({ model }: { readonly model: CommunityModel }) {
  const t = useT();
  const locale = useLocale();
  const isBusy = model.send === "sending";
  return (
    <>
      <SectionTitle title={t("courier.flow.community.typeTitle")} />
      <CommunityChoiceList
        options={model.types.map((type) => ({
          id: type.id,
          label: locale === "en" && type.label_en ? type.label_en : type.label_es,
        }))}
        selectedId={model.typeId}
        onSelect={model.selectType}
        emptyLabel={t("courier.flow.community.noTypes")}
        disabled={isBusy}
      />
      {model.needsOther ? (
        <TextField
          label={t("courier.flow.community.otherLabel")}
          value={model.otherText}
          onChangeText={model.setOtherText}
          editable={!isBusy}
        />
      ) : null}
      <SectionTitle title={t("courier.flow.community.zoneTitle")} />
      <CommunityChoiceList
        options={model.zones.map((zone) => ({
          id: zone.id,
          label: zone.code,
          hint: zone.quadrant_code,
        }))}
        selectedId={model.zoneId}
        onSelect={model.selectZone}
        emptyLabel={t("courier.flow.community.noZones")}
        disabled={isBusy}
      />
      <Counter
        label={t("courier.flow.community.attendance")}
        value={model.attendance}
        onChange={model.setAttendance}
      />
      <SectionTitle title={t("courier.flow.community.agreementsTitle")} />
      <TextField
        label={t("courier.flow.community.agreementsTitle")}
        value={model.agreements}
        onChangeText={model.setAgreements}
        editable={!isBusy}
        multiline
        maxLength={1000}
      />
      <AppText variant="caption" tone="secondary">
        {t("courier.flow.community.privacyHint")}
      </AppText>
    </>
  );
}
