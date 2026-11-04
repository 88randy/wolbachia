import { useState } from 'react';
import { Text } from 'react-native';

import DeviceControl from '../../modules/device-control';
import type { GeoOpenResult } from '../../modules/device-control';
import { GO_THERE_TARGET, ORGANIC_MAPS_PACKAGE } from '../config';
import { Button, KeyValue, LogView, Note, Screen, Section, errorMessage, useLog } from '../ui';

const GEO_URI = `geo:${GO_THERE_TARGET.lat},${GO_THERE_TARGET.lng}?q=${GO_THERE_TARGET.lat},${GO_THERE_TARGET.lng}(${encodeURIComponent(
  GO_THERE_TARGET.label
)})`;

function describe(result: GeoOpenResult): string {
  switch (result) {
    case 'opened':
      return 'Opened. Check that the pin is at the right place and that Back returns to this app.';
    case 'not_installed':
      return 'Organic Maps is not installed. The real app must show a clear message with the next step.';
    case 'no_handler':
      return 'No installed app can handle geo: links.';
  }
}

export function GoThereScreen() {
  const logger = useLog();
  const { log } = logger;
  const [installed, setInstalled] = useState<string>('(not checked)');
  const [message, setMessage] = useState<string>('-');

  const check = () => {
    try {
      setInstalled(String(DeviceControl.isPackageInstalled(ORGANIC_MAPS_PACKAGE)));
    } catch (error) {
      log(`ERROR checking package: ${errorMessage(error)}`);
    }
  };

  const open = async (packageName: string | null) => {
    try {
      const status = DeviceControl.getDeviceStatus();
      if (status.lockTaskModeState === 'locked') {
        log('WARNING: lock task mode is on. Other apps only open if they are in the lock task allowlist.');
      }
      const result = await DeviceControl.openGeoUri(GEO_URI, packageName);
      setMessage(describe(result));
      log(`openGeoUri(${packageName ?? 'any app'}) -> ${result}`);
    } catch (error) {
      log(`ERROR opening geo uri: ${errorMessage(error)}`);
    }
  };

  return (
    <Screen>
      <Section title="How to get there (Organic Maps)">
        <Note>
          Test twice: with Organic Maps installed and without it (uninstall it first). Also test with lock task mode on
          (Dedicated screen): Organic Maps must be in the allowlist or Android blocks it.
        </Note>
        <KeyValue label="geo URI" value={GEO_URI} />
        <Button label="Check if Organic Maps is installed" onPress={check} />
        <KeyValue label="Installed" value={installed} />
        <Button label="Open in Organic Maps" onPress={() => void open(ORGANIC_MAPS_PACKAGE)} />
        <Button label="Open with any map app (chooser or default)" onPress={() => void open(null)} />
        <Text>{message}</Text>
      </Section>
      <Section title="Log (newest first)">
        <LogView logger={logger} />
      </Section>
    </Screen>
  );
}
