import { Channel, invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  BluetoothDiscovery,
  DeviceModelInfo,
  DeviceSnapshot,
  DiscoveredDevice,
  PairedDeviceInfo,
  QuickPreset,
  SettingUpdate,
} from "./types";

export const api = {
  listDeviceModels: () => invoke<DeviceModelInfo[]>("list_device_models"),
  listPairedDevices: () => invoke<PairedDeviceInfo[]>("list_paired_devices"),
  listAvailableBluetooth: () => invoke<BluetoothDiscovery>("list_available_bluetooth_devices"),
  discoverBluetooth: (scanId: number, onDevices: (devices: DiscoveredDevice[]) => void) =>
    invoke<BluetoothDiscovery>("discover_bluetooth_devices", {
      scanId,
      updates: new Channel(onDevices),
    }),
  stopBluetoothScan: (scanId: number) => invoke<void>("stop_bluetooth_scan", { scanId }),
  enableBluetooth: () => invoke<void>("enable_bluetooth"),
  openBluetoothSettings: () => invoke<void>("open_bluetooth_settings"),
  pairDevice: (macAddress: string, model: string, nativeId?: string | null) =>
    invoke<void>("pair_device", { macAddress, model, nativeId: nativeId ?? null }),
  unpairDevice: (macAddress: string) =>
    invoke<void>("unpair_device", { macAddress }),
  connectDevice: (macAddress: string) =>
    invoke<DeviceSnapshot>("connect_device", { macAddress }),
  disconnectDevice: () => invoke<void>("disconnect_device"),
  getDeviceSnapshot: () => invoke<DeviceSnapshot | null>("get_device_snapshot"),
  setSettingValues: (updates: SettingUpdate[]) =>
    invoke<DeviceSnapshot>("set_setting_values", { updates }),
  listQuickPresets: () => invoke<QuickPreset[]>("list_quick_presets"),
  saveQuickPreset: (name: string) =>
    invoke<QuickPreset[]>("save_quick_preset", { name }),
  activateQuickPreset: (name: string) =>
    invoke<DeviceSnapshot>("activate_quick_preset", { name }),
  deleteQuickPreset: (name: string) =>
    invoke<QuickPreset[]>("delete_quick_preset", { name }),
  toggleQuickPresetField: (name: string, settingId: string, isEnabled: boolean) =>
    invoke<QuickPreset[]>("toggle_quick_preset_field", {
      name,
      settingId,
      isEnabled,
    }),
  onDeviceUpdated: (cb: (snapshot: DeviceSnapshot) => void): Promise<UnlistenFn> =>
    listen<DeviceSnapshot>("device-updated", (event) => cb(event.payload)),
  onDeviceDisconnected: (cb: (mac: string) => void): Promise<UnlistenFn> =>
    listen<string>("device-disconnected", (event) => cb(event.payload)),
};
