import {
  Bug,
  DoorClosed,
  Fuel,
  Package,
  QrCode,
  Siren,
  TriangleAlert,
  Users,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import type { MessageKey } from "@wolbachia/i18n";
import { useSyncExternalStore } from "react";
import { View } from "react-native";

import { useServices } from "../../app/services-context.ts";

import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import type { Route } from "../../navigation/routes.ts";
import { ActionGrid } from "../../ui/ActionGrid.tsx";
import type { ActionTileTone } from "../../ui/ActionTile.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";

interface HomeTilesProps {
  /** A local shift that allows capture exists (same rule the old P3 entries used). */
  readonly canCapture: boolean;
  /** The shift is open (or closed on the phone): Cerrar día opens its flow or summary. */
  readonly hasShift: boolean;
}

/** Which local fact enables a tile: a capture-ready shift, any shift, or always. */
type Gate = "capture" | "shift" | "always";

interface TileSpec {
  readonly icon: LucideIcon;
  readonly labelKey: MessageKey;
  readonly route: Route;
  readonly gate: Gate;
  readonly tone?: ActionTileTone;
}

const TILES: readonly TileSpec[] = [
  { icon: QrCode, labelKey: "courier.tile.scan", route: { name: "qrScanner" }, gate: "capture" },
  {
    icon: Bug,
    labelKey: "courier.tile.ovitrap",
    route: { name: "ovitrapCapture" },
    gate: "capture",
  },
  {
    icon: Package,
    labelKey: "courier.tile.supplies",
    route: { name: "supplyReceipt" },
    gate: "capture",
  },
  { icon: Fuel, labelKey: "courier.tile.fuel", route: { name: "fuel" }, gate: "capture" },
  {
    icon: TriangleAlert,
    labelKey: "courier.tile.incident",
    route: { name: "incidents" },
    gate: "always",
  },
  {
    icon: DoorClosed,
    labelKey: "courier.tile.closeDay",
    route: { name: "closeShift" },
    gate: "shift",
  },
  {
    icon: Siren,
    labelKey: "courier.tile.emergency",
    route: { name: "emergency" },
    gate: "always",
    tone: "danger",
  },
];

const COMMUNITY_PERMISSION = "community_activity.read";

/** "Actividad comunitaria": only for users who hold the community permission (promoter, courier). */
const COMMUNITY_TILE: TileSpec = {
  icon: Users,
  labelKey: "courier.flow.community.tile",
  route: { name: "communityActivity" },
  gate: "always",
};

/** "Otras acciones" grid of Mi día: two tiles per row, emergency always available. */
export function HomeTiles({ canCapture, hasShift }: HomeTilesProps) {
  const t = useT();
  const { push } = useNavigation();
  const { auth } = useServices();
  const { profile } = useSyncExternalStore(auth.subscribe, auth.getSnapshot);
  const canSeeCommunity = profile?.permissions.includes(COMMUNITY_PERMISSION) ?? false;
  const isOpen: Readonly<Record<Gate, boolean>> = {
    capture: canCapture,
    shift: hasShift,
    always: true,
  };
  const specs = canSeeCommunity ? [...TILES, COMMUNITY_TILE] : TILES;
  const items = specs.map((spec) => ({
    key: spec.labelKey,
    icon: spec.icon,
    label: t(spec.labelKey),
    tone: spec.tone,
    disabled: !isOpen[spec.gate],
    onPress: () => {
      push(spec.route);
    },
  }));
  return (
    <View className="gap-3">
      <AppText variant="bodyStrong" tone="secondary" accessibilityRole="header">
        {t("courier.home.tools")}
      </AppText>
      {canCapture ? null : <InfoNotice message={t("courier.home.needsShift")} />}
      <ActionGrid items={items} />
    </View>
  );
}
