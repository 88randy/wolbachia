import { useCallback, useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useBarcodeScannerOutput } from 'react-native-vision-camera-barcode-scanner';
import type { Barcode, TargetBarcodeFormat } from 'react-native-vision-camera-barcode-scanner';

import { Button, KeyValue, LogView, Note, Screen, Section, errorMessage, formatMs, useLog } from '../ui';

/** Must be a stable reference: the hook recreates the native output when this changes. */
const FORMATS: TargetBarcodeFormat[] = ['qr-code'];

export function ScannerScreen() {
  const logger = useLog();
  const { log } = logger;
  const permission = useCameraPermission();
  const device = useCameraDevice('back');
  const [active, setActive] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [lastValue, setLastValue] = useState<string>('(nothing scanned)');
  const [lastTiming, setLastTiming] = useState<string>('-');
  const armedAt = useRef<number | null>(null);

  const onBarcodeScanned = useCallback(
    (barcodes: Barcode[]) => {
      const first = barcodes[0];
      if (first === undefined || armedAt.current === null) return;
      const elapsed = performance.now() - armedAt.current;
      armedAt.current = null; // only the first detection after "Arm" is timed
      const value = first.rawValue ?? '(no text value)';
      setLastValue(value);
      setLastTiming(formatMs(elapsed));
      log(`scanned ${first.format} after ${formatMs(elapsed)}: ${value}`);
    },
    [log]
  );

  const onError = useCallback(
    (error: Error) => {
      log(`ERROR scanner: ${errorMessage(error)}`);
    },
    [log]
  );

  const scannerOutput = useBarcodeScannerOutput({ barcodeFormats: FORMATS, onBarcodeScanned, onError });
  const outputs = useMemo(() => [scannerOutput], [scannerOutput]);

  const requestPermission = async () => {
    try {
      const granted = await permission.requestPermission();
      log(`camera permission request result: ${granted ? 'granted' : 'denied'} (status ${permission.status})`);
    } catch (error) {
      log(`ERROR requesting permission: ${errorMessage(error)}`);
    }
  };

  const arm = () => {
    armedAt.current = performance.now();
    setLastValue('(waiting for a code)');
    setLastTiming('-');
    log('armed: point the camera at a code now');
  };

  return (
    <Screen>
      <Section title="QR scanning (VisionCamera + ML Kit)">
        <Note>
          Test in sunlight, in shade, with a damaged label, and with the torch. Time shown is from pressing "Arm" to the
          first decoded code. Evidence: screen recording.
        </Note>
        <KeyValue label="Camera permission" value={permission.status} />
        {!permission.hasPermission ? (
          permission.canRequestPermission ? (
            <Button label="Request camera permission" onPress={requestPermission} />
          ) : (
            <>
              <Text style={styles.warn}>Permission denied. The app must show a clear message and a way to fix it.</Text>
              <Button label="Open app settings" onPress={() => void Linking.openSettings()} />
            </>
          )
        ) : null}
        {permission.hasPermission && device === undefined ? <Text style={styles.warn}>No back camera found.</Text> : null}
        {permission.hasPermission && device !== undefined ? (
          <>
            <View style={styles.preview}>
              <Camera
                style={StyleSheet.absoluteFill}
                isActive={active}
                device={device}
                outputs={outputs}
                torchMode={torchOn && device.hasTorch ? 'on' : 'off'}
                onStarted={() => log('camera session started')}
                onError={onError}
              />
            </View>
            <Button label={active ? 'Stop camera' : 'Start camera'} onPress={() => setActive((value) => !value)} />
            <Button label="Arm (start timing)" onPress={arm} disabled={!active} />
            <Button
              label={torchOn ? 'Torch off' : 'Torch on'}
              onPress={() => setTorchOn((value) => !value)}
              disabled={!active || !device.hasTorch}
            />
            <KeyValue label="Device has torch" value={String(device.hasTorch)} />
            <KeyValue label="Last value" value={lastValue} />
            <KeyValue label="Time to first read" value={lastTiming} />
          </>
        ) : null}
      </Section>
      <Section title="Log (newest first)">
        <LogView logger={logger} />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { height: 280, backgroundColor: '#000000', overflow: 'hidden', borderRadius: 6 },
  warn: { color: '#b00020' },
});
