import { useT } from "../i18n/I18nProvider.tsx";
import { useNavigation } from "../navigation/NavigationProvider.tsx";
import { useTheme } from "../theme/ThemeProvider.tsx";
import { HeaderBar } from "./HeaderBar.tsx";
import { IconButton } from "./IconButton.tsx";
import { SyncChip } from "./SyncChip.tsx";

/** Surface header with the sync status and one Settings action. */
export function TopBar({ title }: { readonly title: string }) {
  const { theme } = useTheme();
  const t = useT();
  const { push } = useNavigation();
  return (
    <HeaderBar title={title}>
      <SyncChip />
      <IconButton
        icon="settings"
        label={t("mobile.nav.settings")}
        color={theme.color.text.primary}
        onPress={() => {
          push({ name: "settings" });
        }}
      />
    </HeaderBar>
  );
}
