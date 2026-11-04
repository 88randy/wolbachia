import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export const colors = {
  bg: '#ffffff',
  fg: '#111111',
  muted: '#666666',
  primary: '#0b5fff',
  danger: '#b00020',
  ok: '#1b7f3b',
  border: '#cccccc',
};

export function Button(props: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      style={[
        styles.button,
        props.danger ? { backgroundColor: colors.danger } : null,
        props.disabled ? styles.buttonDisabled : null,
      ]}
    >
      <Text style={styles.buttonText}>{props.label}</Text>
    </Pressable>
  );
}

export function Section(props: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{props.title}</Text>
      {props.children}
    </View>
  );
}

export function KeyValue(props: { label: string; value: string }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvLabel}>{props.label}</Text>
      <Text style={styles.kvValue}>{props.value}</Text>
    </View>
  );
}

export function Screen(props: { children: ReactNode }) {
  return <ScrollView contentContainerStyle={styles.screen}>{props.children}</ScrollView>;
}

export function Note(props: { children: ReactNode }) {
  return <Text style={styles.note}>{props.children}</Text>;
}

export type Logger = { lines: string[]; log: (message: string) => void; clear: () => void };

/** On-screen log so the owner can film results. Keeps the last 60 lines. */
export function useLog(): Logger {
  const [lines, setLines] = useState<string[]>([]);
  const counter = useRef(0);
  const log = useCallback((message: string) => {
    counter.current += 1;
    const stamp = new Date().toISOString().slice(11, 23);
    setLines((previous) => [`${stamp} ${message}`, ...previous].slice(0, 60));
  }, []);
  const clear = useCallback(() => setLines([]), []);
  return { lines, log, clear };
}

export function LogView(props: { logger: Logger }) {
  return (
    <View style={styles.log}>
      {props.logger.lines.length === 0 ? <Text style={styles.logLine}>(no log yet)</Text> : null}
      {props.logger.lines.map((line, index) => (
        <Text key={`${index}-${line}`} style={styles.logLine}>
          {line}
        </Text>
      ))}
    </View>
  );
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatMs(ms: number): string {
  return `${ms.toFixed(1)} ms`;
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 12 },
  section: { gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.fg },
  button: { backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 6 },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#ffffff', fontWeight: '600', textAlign: 'center' },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  kvLabel: { color: colors.muted, flexShrink: 1 },
  kvValue: { color: colors.fg, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  note: { color: colors.muted, fontSize: 12 },
  log: { backgroundColor: '#f4f4f4', padding: 8, borderRadius: 6, gap: 2 },
  logLine: { fontFamily: 'monospace', fontSize: 11, color: colors.fg },
});
