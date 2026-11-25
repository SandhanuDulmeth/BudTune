use std::{str::FromStr, sync::Arc};

use macaddr::MacAddr6;
use openscq30_i18n::Translate;
use openscq30_lib::{
    DeviceModel, OpenSCQ30Session,
    connection::ConnectionStatus,
    device::OpenSCQ30Device,
    settings::{CategoryId, Setting, SettingId, Value},
    storage::{PairedDevice, QuickPreset},
};
use serde::{Deserialize, Serialize};
use strum::VariantArray;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::Mutex;

mod bluetooth;
use bluetooth::{enable_bluetooth, open_bluetooth_settings};

struct ActiveConnection {
    mac_address: String,
    device: Arc<dyn OpenSCQ30Device + Send + Sync>,
    watcher_abort: tokio::task::AbortHandle,
}

impl Drop for ActiveConnection {
    fn drop(&mut self) {
        self.watcher_abort.abort();
    }
}

pub struct AppState {
    session: Arc<OpenSCQ30Session>,
    active: Mutex<Option<ActiveConnection>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceModelInfo {
    pub id: DeviceModel,
    pub name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairedDeviceInfo {
    pub mac_address: String,
    pub model: DeviceModel,
    pub model_name: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SettingEntry {
    pub id: SettingId,
    pub label: String,
    pub setting: Setting,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CategoryGroup {
    pub id: CategoryId,
    pub label: String,
    pub settings: Vec<SettingEntry>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeviceSnapshot {
    pub mac_address: String,
    pub model: DeviceModel,
    pub model_name: String,
    pub connected: bool,
    pub battery: BatterySnapshot,
    pub categories: Vec<CategoryGroup>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BatteryReading {
    percent: u8,
    charging: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BatterySnapshot {
    left: Option<BatteryReading>,
    right: Option<BatteryReading>,
    device: Option<BatteryReading>,
    case: Option<BatteryReading>,
}

fn battery_percent(value: &str) -> Option<u8> {
    let (level, total) = value.split_once('/')?;
    let level = level.parse::<u16>().ok()?;
    let total = total.parse::<u16>().ok()?;
    if total == 0 || level > total {
        return None;
    }
    Some((u32::from(level) * 100 / u32::from(total)) as u8)
}

fn battery_reading(
    device: &dyn OpenSCQ30Device,
    level: SettingId,
    charging: Option<SettingId>,
) -> Option<BatteryReading> {
    let Setting::Information { value, .. } = device.setting(&level)? else {
        return None;
    };
    let charging = match charging.and_then(|id| device.setting(&id)) {
        Some(Setting::Information { value, .. }) => value.eq_ignore_ascii_case("yes"),
        Some(Setting::Toggle { value }) => value,
        _ => false,
    };
    Some(BatteryReading {
        percent: battery_percent(&value)?,
        charging,
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingUpdate {
    pub setting_id: SettingId,
    pub value: Value,
}

fn build_snapshot(
    mac_address: &str,
    device: &(dyn OpenSCQ30Device + Send + Sync),
) -> DeviceSnapshot {
    let connected = matches!(
        *device.connection_status().borrow(),
        ConnectionStatus::Connected
    );
    let categories = device
        .categories()
        .into_iter()
        .map(|category_id| {
            let settings = device
                .settings_in_category(&category_id)
                .into_iter()
                .filter_map(|setting_id| {
                    device.setting(&setting_id).map(|setting| SettingEntry {
                        id: setting_id,
                        label: setting_id.translate(),
                        setting,
                    })
                })
                .collect::<Vec<_>>();
            CategoryGroup {
                id: category_id,
                label: category_id.translate(),
                settings,
            }
        })
        .collect::<Vec<_>>();

    DeviceSnapshot {
        mac_address: mac_address.to_string(),
        model: device.model(),
        model_name: device.model().translate(),
        connected,
        battery: BatterySnapshot {
            left: battery_reading(
                device,
                SettingId::BatteryLevelLeft,
                Some(SettingId::IsChargingLeft),
            ),
            right: battery_reading(
                device,
                SettingId::BatteryLevelRight,
                Some(SettingId::IsChargingRight),
            ),
            device: battery_reading(device, SettingId::BatteryLevel, Some(SettingId::IsCharging)),
            case: battery_reading(device, SettingId::CaseBatteryLevel, None),
        },
        categories,
    }
}

#[tauri::command]
fn list_device_models() -> Vec<DeviceModelInfo> {
    DeviceModel::VARIANTS
        .iter()
        .copied()
        .filter(|model| *model != DeviceModel::SoundcoreDevelopment)
        .map(|model| DeviceModelInfo {
            id: model,
            name: model.translate(),
        })
        .collect()
}

#[tauri::command]
async fn list_paired_devices(state: State<'_, AppState>) -> Result<Vec<PairedDeviceInfo>, String> {
    let devices = state
        .session
        .paired_devices()
        .await
        .map_err(|e| e.to_string())?;
    Ok(devices
        .into_iter()
        .filter(|device| !device.is_demo)
        .map(|d| PairedDeviceInfo {
            mac_address: d.mac_address.to_string(),
            model: d.model,
            model_name: d.model.translate(),
        })
        .collect())
}

#[tauri::command]
async fn pair_device(
    state: State<'_, AppState>,
    mac_address: String,
    model: DeviceModel,
    native_id: Option<String>,
) -> Result<(), String> {
    let mac = MacAddr6::from_str(&mac_address).map_err(|e| format!("Invalid MAC address: {e}"))?;
    if let Some(id) = native_id {
        bluetooth::pair_native(id, mac, model).await?;
    }
    state
        .session
        .pair(PairedDevice {
            mac_address: mac,
            model,
            is_demo: false,
        })
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn unpair_device(state: State<'_, AppState>, mac_address: String) -> Result<(), String> {
    {
        let mut guard = state.active.lock().await;
        if let Some(active) = guard.as_ref() {
            if active.mac_address.eq_ignore_ascii_case(&mac_address) {
                *guard = None;
            }
        }
    }
    let mac = MacAddr6::from_str(&mac_address).map_err(|e| format!("Invalid MAC address: {e}"))?;
    state.session.unpair(mac).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn connect_device(
    app: AppHandle,
    state: State<'_, AppState>,
    mac_address: String,
) -> Result<DeviceSnapshot, String> {
    let mac = MacAddr6::from_str(&mac_address).map_err(|e| format!("Invalid MAC address: {e}"))?;
    let mut guard = state.active.lock().await;
    if state
        .session
        .paired_devices()
        .await
        .map_err(|e| e.to_string())?
        .iter()
        .any(|device| device.mac_address == mac && device.is_demo)
    {
        return Err("Select a Soundcore device from the Bluetooth scan first.".into());
    }
    *guard = None;
    let device = tokio::time::timeout(
        std::time::Duration::from_secs(18),
        state.session.connect(mac),
    )
        .await
        .map_err(|_| "Connection timed out. Wake your earbuds and try again.".to_string())?
        .map_err(|e| format!("Could not open earbud controls: {e}. Check that the earbuds are connected for audio, then retry."))?;

    let mut settings_rx = device.watch_for_changes();
    let mut conn_rx = device.connection_status();
    let snapshot = build_snapshot(&mac_address, device.as_ref());

    let device_clone = Arc::clone(&device);
    let mac_clone = mac_address.clone();
    let app_handle = app.clone();

    let handle = tokio::spawn(async move {
        loop {
            tokio::select! {
                res = settings_rx.changed() => {
                    if res.is_err() {
                        break;
                    }
                    let snap = build_snapshot(&mac_clone, device_clone.as_ref());
                    let _ = app_handle.emit("device-updated", snap);
                }
                res = conn_rx.changed() => {
                    if res.is_err() {
                        break;
                    }
                    let status = *conn_rx.borrow();
                    if matches!(status, ConnectionStatus::Disconnected) {
                        let _ = app_handle.emit("device-disconnected", mac_clone.clone());
                        break;
                    }
                }
            }
        }
    });

    *guard = Some(ActiveConnection {
        mac_address,
        device,
        watcher_abort: handle.abort_handle(),
    });

    Ok(snapshot)
}

#[tauri::command]
async fn disconnect_device(state: State<'_, AppState>) -> Result<(), String> {
    let mut guard = state.active.lock().await;
    *guard = None;
    Ok(())
}

#[tauri::command]
async fn get_device_snapshot(state: State<'_, AppState>) -> Result<Option<DeviceSnapshot>, String> {
    let guard = state.active.lock().await;
    Ok(guard
        .as_ref()
        .map(|active| build_snapshot(&active.mac_address, active.device.as_ref())))
}

#[tauri::command]
async fn set_setting_values(
    state: State<'_, AppState>,
    updates: Vec<SettingUpdate>,
) -> Result<DeviceSnapshot, String> {
    let guard = state.active.lock().await;
    let active = guard.as_ref().ok_or("No device connected")?;
    let pairs = updates
        .into_iter()
        .map(|u| (u.setting_id, u.value))
        .collect::<Vec<_>>();
    active
        .device
        .set_setting_values(pairs)
        .await
        .map_err(|e| format!("Failed to update setting: {e}"))?;
    Ok(build_snapshot(&active.mac_address, active.device.as_ref()))
}

#[tauri::command]
async fn list_quick_presets(state: State<'_, AppState>) -> Result<Vec<QuickPreset>, String> {
    let guard = state.active.lock().await;
    let active = guard.as_ref().ok_or("No device connected")?;
    state
        .session
        .quick_preset_handler()
        .quick_presets(active.device.as_ref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_quick_preset(
    state: State<'_, AppState>,
    name: String,
) -> Result<Vec<QuickPreset>, String> {
    let guard = state.active.lock().await;
    let active = guard.as_ref().ok_or("No device connected")?;
    let handler = state.session.quick_preset_handler();
    handler
        .save(active.device.as_ref(), name)
        .await
        .map_err(|e| e.to_string())?;
    handler
        .quick_presets(active.device.as_ref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn activate_quick_preset(
    state: State<'_, AppState>,
    name: String,
) -> Result<DeviceSnapshot, String> {
    let guard = state.active.lock().await;
    let active = guard.as_ref().ok_or("No device connected")?;
    state
        .session
        .quick_preset_handler()
        .activate(active.device.as_ref(), &name)
        .await
        .map_err(|e| e.to_string())?;
    Ok(build_snapshot(&active.mac_address, active.device.as_ref()))
}

#[tauri::command]
async fn delete_quick_preset(
    state: State<'_, AppState>,
    name: String,
) -> Result<Vec<QuickPreset>, String> {
    let guard = state.active.lock().await;
    let active = guard.as_ref().ok_or("No device connected")?;
    let handler = state.session.quick_preset_handler();
    handler
        .delete(active.device.as_ref(), name)
        .await
        .map_err(|e| e.to_string())?;
    handler
        .quick_presets(active.device.as_ref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn toggle_quick_preset_field(
    state: State<'_, AppState>,
    name: String,
    setting_id: SettingId,
    is_enabled: bool,
) -> Result<Vec<QuickPreset>, String> {
    let guard = state.active.lock().await;
    let active = guard.as_ref().ok_or("No device connected")?;
    let handler = state.session.quick_preset_handler();
    handler
        .toggle_field(active.device.as_ref(), name, setting_id, is_enabled)
        .await
        .map_err(|e| e.to_string())?;
    handler
        .quick_presets(active.device.as_ref())
        .await
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let config_dir = dirs::config_dir()
                .unwrap_or_else(|| std::path::PathBuf::from("."))
                .join("BudTune");
            std::fs::create_dir_all(&config_dir)?;
            let db_path = config_dir.join("budtune.sqlite");
            let session = tauri::async_runtime::block_on(OpenSCQ30Session::new(db_path))
                .map_err(|e| anyhow::anyhow!("Failed to initialize BudTune database: {e}"))?;

            app.manage(bluetooth::NearbyScan::default());
            app.manage(AppState {
                session: Arc::new(session),
                active: Mutex::new(None),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_device_models,
            list_paired_devices,
            bluetooth::list_available_bluetooth_devices,
            bluetooth::discover_bluetooth_devices,
            bluetooth::stop_bluetooth_scan,
            enable_bluetooth,
            open_bluetooth_settings,
            pair_device,
            unpair_device,
            connect_device,
            disconnect_device,
            get_device_snapshot,
            set_setting_values,
            list_quick_presets,
            save_quick_preset,
            activate_quick_preset,
            delete_quick_preset,
            toggle_quick_preset_field,
        ])
        .run(tauri::generate_context!())
        .expect("error while running BudTune");
}

#[cfg(test)]
mod tests {
    use super::battery_percent;

    #[test]
    fn uses_the_devices_reported_battery_scale() {
        assert_eq!(battery_percent("3/5"), Some(60));
        assert_eq!(battery_percent("2/100"), Some(2));
        assert_eq!(battery_percent("0/5"), Some(0));
        assert_eq!(battery_percent("255/5"), None);
        assert_eq!(battery_percent("1/0"), None);
    }
}
