import { useEffect, useState } from 'react';
import { Switch, Text, TextInput, View } from 'react-native';

import DeviceControl from '../../modules/device-control';
import type { DeviceStatus, DownloadResult } from '../../modules/device-control';
import { ORGANIC_MAPS_PACKAGE } from '../config';
import { Button, KeyValue, LogView, Note, Screen, Section, colors, errorMessage, formatBytes, useLog } from '../ui';

function readStatus(): DeviceStatus | null {
  try {
    return DeviceControl.getDeviceStatus();
  } catch (error) {
    console.error('getDeviceStatus failed', error);
    return null;
  }
}

export function DedicatedScreen() {
  const logger = useLog();
  const { log } = logger;
  const [status, setStatus] = useState<DeviceStatus | null>(readStatus);
  const [url, setUrl] = useState('');
  const [sha, setSha] = useState('');
  const [allowHttp, setAllowHttp] = useState(true);
  const [downloaded, setDownloaded] = useState<DownloadResult | null>(null);
  const [progress, setProgress] = useState('-');

  const refresh = () => {
    const next = readStatus();
    setStatus(next);
    if (next === null) log('ERROR could not read device status');
  };

  useEffect(() => {
    const progressSub = DeviceControl.addListener('onDownloadProgress', (event) => {
      const total = event.total >= 0 ? formatBytes(event.total) : 'unknown';
      setProgress(`${formatBytes(event.downloaded)} of ${total}`);
    });
    const installSub = DeviceControl.addListener('onInstallStatus', (event) => {
      log(`install status: ${event.statusName} ${event.message ?? ''}`);
    });
    return () => {
      progressSub.remove();
      installSub.remove();
    };
  }, [log]);

  const attempt = async (label: string, work: () => Promise<void>) => {
    try {
      await work();
      log(`${label}: ok`);
    } catch (error) {
      log(`ERROR ${label}: ${errorMessage(error)}`);
    } finally {
      refresh();
    }
  };

  return (
    <Screen>
      <Section title="Device owner and lock task mode">
        <Note>
          Provision Device Owner first with adb (README, step "Provision Device Owner"). Without it the lock task buttons
          fail on purpose with a clear message.
        </Note>
        <KeyValue label="Phone" value={status === null ? '-' : `${status.manufacturer} ${status.model}`} />
        <KeyValue label="Android SDK" value={status === null ? '-' : String(status.sdkInt)} />
        <KeyValue label="Admin component" value={status === null ? '-' : status.adminComponent} />
        <KeyValue label="Is Device Owner" value={status === null ? '-' : String(status.isDeviceOwner)} />
        <KeyValue label="Lock task permitted" value={status === null ? '-' : String(status.isLockTaskPermitted)} />
        <KeyValue label="Lock task state" value={status === null ? '-' : status.lockTaskModeState} />
        <Button label="Refresh status" onPress={refresh} />
        <Button
          label="Enable lock task (allowlist this app and Organic Maps)"
          onPress={() => void attempt('enable lock task', () => DeviceControl.enableLockTask([ORGANIC_MAPS_PACKAGE]))}
        />
        <Button
          label="Disable lock task (keep allowlist)"
          onPress={() => void attempt('disable lock task', () => DeviceControl.disableLockTask(false))}
        />
        <Button
          label="Disable lock task and clear allowlist"
          onPress={() => void attempt('disable lock task + clear', () => DeviceControl.disableLockTask(true))}
        />
        <Button
          label="Release Device Owner (test cleanup)"
          danger
          onPress={() => void attempt('release device owner', () => DeviceControl.clearDeviceOwner())}
        />
      </Section>

      <Section title="In-app APK update">
        <Note>
          Build a second APK with a higher android.versionCode, sign it with the same key, host it (README) and paste its
          URL and SHA-256 here. After the install the app restarts: check the version below.
        </Note>
        <KeyValue label="Installed version" value={status === null ? '-' : `${status.versionName ?? '?'} (${status.versionCode})`} />
        <KeyValue
          label="Last update time"
          value={status === null ? '-' : new Date(status.lastUpdateTime).toISOString()}
        />
        <KeyValue label="Free storage" value={status === null ? '-' : formatBytes(status.freeBytes)} />
        <TextInput
          style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 8 }}
          value={url}
          onChangeText={setUrl}
          placeholder="http://192.168.1.10:8000/app-release.apk"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 8 }}
          value={sha}
          onChangeText={setSha}
          placeholder="SHA-256 (hex), leave blank to skip the check"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Switch value={allowHttp} onValueChange={setAllowHttp} />
          <Text>Allow plain http (LAN test server only)</Text>
        </View>
        <Button
          label="Download (resumes if interrupted)"
          onPress={() =>
            void attempt('download', async () => {
              const result = await DeviceControl.downloadApk(url.trim(), sha.trim(), allowHttp);
              setDownloaded(result);
              log(`downloaded ${formatBytes(result.bytes)} sha256 ${result.sha256}`);
            })
          }
        />
        <KeyValue label="Progress" value={progress} />
        <KeyValue label="Downloaded file" value={downloaded === null ? '-' : formatBytes(downloaded.bytes)} />
        <Button
          label="Install downloaded APK"
          disabled={downloaded === null}
          onPress={() =>
            void attempt('install', async () => {
              if (downloaded === null) throw new Error('Nothing downloaded yet');
              await DeviceControl.installApk(downloaded.path);
            })
          }
        />
        <Button
          label="Discard downloaded files"
          onPress={() =>
            void attempt('discard', async () => {
              await DeviceControl.discardDownloadedApk();
              setDownloaded(null);
              setProgress('-');
            })
          }
        />
      </Section>

      <Section title="Log (newest first)">
        <LogView logger={logger} />
      </Section>
    </Screen>
  );
}
