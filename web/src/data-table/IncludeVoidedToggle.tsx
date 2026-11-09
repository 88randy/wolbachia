import { useTranslation } from "react-i18next";
import { Switch } from "../ui/Switch";
interface Props {
  isOn: boolean;
  onChange: (isOn: boolean) => void;
}
export function IncludeVoidedToggle({ isOn, onChange }: Props) {
  const { t } = useTranslation();
  return <Switch label={t("table.filters.includeVoided")} isOn={isOn} onChange={onChange} />;
}
