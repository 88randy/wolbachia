import { NativeModule, requireNativeModule } from 'expo';

export type DeviceStatus = {
  packageName: string;
  adminComponent: string;
  isDeviceOwner: boolean;
  isAdminActive: boolean;
  isLockTaskPermitted: boolean;
  lockTaskModeState: 'none' | 'locked' | 'pinned' | 'unknown';
  sdkInt: number;
  manufacturer: string;
  model: string;
  versionName: string | null;
  versionCode: number;
  /** Epoch ms of the last install/update of this package. */
  lastUpdateTime: number;
  freeBytes: number;
};

export type DownloadProgress = { downloaded: number; total: number };

export type InstallStatusEvent = {
  status: number;
  statusName: string;
  message: string | null;
};

export type DownloadResult = { path: string; bytes: number; sha256: string };

export type GeoOpenResult = 'opened' | 'not_installed' | 'no_handler' | 'blocked_by_lock_task';

type DeviceControlEvents = {
  onDownloadProgress: (progress: DownloadProgress) => void;
  onInstallStatus: (event: InstallStatusEvent) => void;
};

declare class DeviceControlNative extends NativeModule<DeviceControlEvents> {
  getDeviceStatus(): DeviceStatus;
  enableLockTask(extraPackages: string[]): Promise<void>;
  disableLockTask(clearAllowlist: boolean): Promise<void>;
  clearDeviceOwner(): Promise<void>;
  /** App-specific external files dir (no permission needed), or null when unavailable. */
  getExternalFilesDir(): string | null;
  isPackageInstalled(packageName: string): boolean;
  openGeoUri(uri: string, packageName: string | null): Promise<GeoOpenResult>;
  downloadApk(url: string, expectedSha256: string, allowHttp: boolean): Promise<DownloadResult>;
  installApk(path: string): Promise<void>;
  discardDownloadedApk(): Promise<void>;
}

export default requireNativeModule<DeviceControlNative>('DeviceControl');
