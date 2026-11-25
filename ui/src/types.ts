export interface DeviceModelInfo {
  id: string;
  name: string;
}

export interface PairedDeviceInfo {
  macAddress: string;
  model: string;
  modelName: string;
}

export interface DiscoveredDevice {
  name: string;
  macAddress: string;
  model: string | null;
  paired: boolean;
  connected: boolean;
  nativeId: string | null;
}

export interface BluetoothDiscovery {
  devices: DiscoveredDevice[];
  radio: "on" | "off" | "unknown";
  canEnable: boolean;
}

export interface BatteryReading {
  percent: number;
  charging: boolean;
}

export interface RangeSpec {
  start: number;
  end: number;
  step: number;
}

export interface SelectSpec {
  options: string[];
  localizedOptions: string[];
}

export interface EqualizerSpec {
  bandHz: number[];
  fractionDigits: number;
  min: number;
  max: number;
}

export type Setting =
  | { type: "toggle"; value: boolean }
  | { type: "i32Range"; setting: RangeSpec; value: number }
  | { type: "select"; setting: SelectSpec; value: string }
  | { type: "optionalSelect"; setting: SelectSpec; value: string | null }
  | { type: "modifiableSelect"; setting: SelectSpec; value: string | null }
  | { type: "multiSelect"; setting: SelectSpec; values: string[] }
  | { type: "multiSelectWithRemove"; setting: SelectSpec; values: string[] }
  | { type: "equalizer"; setting: EqualizerSpec; readOnly: boolean; value: number[] }
  | {
      type: "presetEqualizerProfileSelect";
      equalizer: EqualizerSpec;
      select: SelectSpec;
      presets: number[][];
      value: string | null;
    }
  | { type: "information"; value: string; translatedValue: string }
  | { type: "importString"; confirmationMessage: string | null }
  | { type: "hueColorPicker"; hue: number }
  | { type: "action" }
  | { type: "timeOfDay"; minutesAfterMidnight: number };

export type SettingValue =
  | { type: "bool"; value: boolean }
  | { type: "u16"; value: number }
  | { type: "u16Vec"; value: number[] }
  | { type: "optionalU16"; value: number | null }
  | { type: "i16Vec"; value: number[] }
  | { type: "i32"; value: number }
  | { type: "f32"; value: number }
  | { type: "string"; value: string }
  | { type: "stringVec"; value: string[] }
  | { type: "optionalString"; value: string | null }
  | { type: "modifiableSelectCommand"; value: { type: "add" | "remove"; name: string } }
  | { type: "multiSelectWithRemoveCommand"; value: { type: "remove"; name: string } };

export interface SettingEntry {
  id: string;
  label: string;
  setting: Setting;
}

export interface CategoryGroup {
  id: string;
  label: string;
  settings: SettingEntry[];
}

export interface DeviceSnapshot {
  macAddress: string;
  model: string;
  modelName: string;
  connected: boolean;
  battery: {
    left: BatteryReading | null;
    right: BatteryReading | null;
    device: BatteryReading | null;
    case: BatteryReading | null;
  };
  categories: CategoryGroup[];
}

export interface SettingUpdate {
  settingId: string;
  value: SettingValue;
}

export interface QuickPresetField {
  settingId: string;
  value: SettingValue;
  isEnabled: boolean;
}

export interface QuickPreset {
  name: string;
  fields: QuickPresetField[];
}
