import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { DedicatedScreen } from './src/screens/DedicatedScreen';
import { GoThereScreen } from './src/screens/GoThereScreen';
import { MapScreen } from './src/screens/MapScreen';
import { ScannerScreen } from './src/screens/ScannerScreen';
import { SpeedLockScreen } from './src/screens/SpeedLockScreen';
import { StoreScreen } from './src/screens/StoreScreen';
import { colors } from './src/ui';

type TabKey = 'store' | 'scan' | 'map' | 'geo' | 'speed' | 'dedicated';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'store', label: 'Store' },
  { key: 'scan', label: 'QR' },
  { key: 'map', label: 'Map' },
  { key: 'geo', label: 'Go' },
  { key: 'speed', label: 'Speed' },
  { key: 'dedicated', label: 'Admin' },
];

function renderTab(tab: TabKey) {
  switch (tab) {
    case 'store':
      return <StoreScreen />;
    case 'scan':
      return <ScannerScreen />;
    case 'map':
      return <MapScreen />;
    case 'geo':
      return <GoThereScreen />;
    case 'speed':
      return <SpeedLockScreen />;
    case 'dedicated':
      return <DedicatedScreen />;
  }
}

export default function App() {
  const [tab, setTab] = useState<TabKey>('store');
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>{renderTab(tab)}</View>
      <View style={styles.tabs}>
        {TABS.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            onPress={() => setTab(item.key)}
            style={[styles.tab, tab === item.key ? styles.tabActive : null]}
          >
            <Text style={[styles.tabText, tab === item.key ? styles.tabTextActive : null]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingTop: 28 },
  content: { flex: 1 },
  tabs: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { backgroundColor: '#e6eeff' },
  tabText: { color: colors.muted, fontWeight: '600' },
  tabTextActive: { color: colors.primary },
});
