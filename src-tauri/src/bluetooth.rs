use std::{process::Command, time::Duration};

use macaddr::MacAddr6;
use openscq30_i18n::Translate;
use openscq30_lib::{ConnectionBackends, DeviceModel, connection::RfcommBackend};
use serde::Serialize;
use strum::VariantArray;
use tauri::{State, ipc::Channel};
use tokio::sync::{Mutex, oneshot};

#[cfg(windows)]
mod nearby;

#[derive(Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredDevice {
    pub name: String,
    pub mac_address: String,
    pub model: Option<DeviceModel>,
    pub paired: bool,
    pub connected: bool,
    pub native_id: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Discovery {
    pub devices: Vec<DiscoveredDevice>,
    pub radio: &'static str,
    pub can_enable: bool,
}

#[derive(Default)]
pub struct NearbyScan(Mutex<Option<(u32, oneshot::Sender<()>)>>);

impl NearbyScan {
    async fn stop(&self, id: u32) {
        let mut active = self.0.lock().await;
        if active.as_ref().is_some_and(|(running, _)| *running == id) {
            active.take();
        }
    }
}

fn normalize(name: &str) -> String {
    name.split(|c: char| !c.is_ascii_alphanumeric())
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
        .to_ascii_lowercase()
}

fn profile_for(name: &str) -> Option<DeviceModel> {
    let name = normalize(name);
    let name = name.strip_prefix("soundcore ").unwrap_or(&name);
    let name = name.strip_prefix("by anker ").unwrap_or(name);
    let name = name.strip_prefix("anker ").unwrap_or(name);
    for model in DeviceModel::VARIANTS.iter().copied() {
        if model != DeviceModel::SoundcoreDevelopment
            && name.eq_ignore_ascii_case(model.as_ref().trim_start_matches("Soundcore"))
        {
            return Some(model);
        }
    }
    // Match full names. For example, R50i NC and Liberty 5 Pro must never use
    // the R50i or Liberty 5 driver simply because their names share a prefix.
    match name {
        "liberty 5" => return Some(DeviceModel::SoundcoreA3957),
        "r50i" | "p20i" | "p25i" => return Some(DeviceModel::SoundcoreA3949),
        "r50i nc" | "p30i" => return Some(DeviceModel::SoundcoreA3959),
        "p31i" => return Some(DeviceModel::SoundcoreD1202),
        "r60i nc" => return Some(DeviceModel::SoundcoreD1202C),
        _ => {}
    }
    DeviceModel::VARIANTS.iter().copied().find(|model| {
        if *model == DeviceModel::SoundcoreDevelopment {
            return false;
        }
        model.translate().split('/').any(|alias| {
            let alias = normalize(alias);
            alias.strip_prefix("soundcore ").unwrap_or(&alias) == name
        })
    })
}

impl DiscoveredDevice {
    fn soundcore(
        name: String,
        mac: MacAddr6,
        paired: bool,
        native_id: Option<String>,
    ) -> Option<Self> {
        let model = profile_for(&name);
        if model.is_none()
            && !normalize(&name)
                .split_whitespace()
                .any(|word| word == "soundcore")
        {
            return None;
        }
        Some(Self {
            name,
            mac_address: mac.to_string(),
            model,
            paired,
            connected: false,
            native_id,
        })
    }
}

async fn available_devices() -> Result<Vec<DiscoveredDevice>, String> {
    let backend =
        openscq30_lib::default_backends().ok_or("Bluetooth is unavailable on this platform.")?;
    let radio = backend.rfcomm().await.map_err(|error| error.to_string())?;
    let devices = radio.devices().await.map_err(|error| error.to_string())?;
    Ok(devices
        .into_iter()
        .filter_map(|device| {
            let mut device =
                DiscoveredDevice::soundcore(device.name, device.mac_address, true, None)?;
            // These platforms' RFCOMM backends enumerate actively connected devices.
            device.connected = cfg!(any(windows, target_os = "linux"));
            Some(device)
        })
        .collect())
}

#[tauri::command]
pub async fn list_available_bluetooth_devices() -> Result<Discovery, String> {
    let available = tokio::time::timeout(Duration::from_secs(5), available_devices())
        .await
        .map_err(|_| "Listing available Bluetooth devices took too long.".to_string())
        .and_then(|result| result);
    #[cfg(windows)]
    let available = match available {
        Ok(devices) if !devices.is_empty() => Ok(devices),
        result => match windows_api::connected_paired_devices().await {
            Ok(devices) if !devices.is_empty() => Ok(devices),
            _ => result,
        },
    };
    let mut devices = available?;
    devices.sort_by(|a, b| {
        a.name
            .cmp(&b.name)
            .then_with(|| a.mac_address.cmp(&b.mac_address))
    });
    Ok(Discovery {
        radio: if devices.iter().any(|device| device.connected) {
            "on"
        } else {
            "unknown"
        },
        devices,
        can_enable: cfg!(windows),
    })
}

#[tauri::command]
pub async fn discover_bluetooth_devices(
    scan_id: u32,
    updates: Channel<Vec<DiscoveredDevice>>,
    scan: State<'_, NearbyScan>,
) -> Result<Discovery, String> {
    let (stop, stopped) = oneshot::channel();
    *scan.0.lock().await = Some((scan_id, stop));
    let result = tokio::select! {
        _ = stopped => Err("Bluetooth scan stopped.".into()),
        result = scan_nearby(updates) => result,
    };
    scan.stop(scan_id).await;
    result
}

#[tauri::command]
pub async fn stop_bluetooth_scan(scan_id: u32, scan: State<'_, NearbyScan>) -> Result<(), String> {
    scan.stop(scan_id).await;
    Ok(())
}

async fn scan_nearby(updates: Channel<Vec<DiscoveredDevice>>) -> Result<Discovery, String> {
    #[cfg(windows)]
    return nearby::discover(updates)
        .await
        .map_err(|error| format!("{error:#}"));

    #[cfg(not(windows))]
    {
        let _ = updates;
        Ok(Discovery {
            devices: Vec::new(),
            radio: "unknown",
            can_enable: false,
        })
    }
}

#[tauri::command]
pub async fn enable_bluetooth(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(windows)]
    return windows_api::enable(&app).await;

    #[cfg(not(windows))]
    {
        let _ = app;
        Err("Turn on Bluetooth in your system settings.".into())
    }
}

#[tauri::command]
pub fn open_bluetooth_settings() -> Result<(), String> {
    #[cfg(windows)]
    let result = Command::new("explorer.exe")
        .arg("ms-settings:bluetooth")
        .spawn();
    #[cfg(target_os = "macos")]
    let result = Command::new("open")
        .arg("x-apple.systempreferences:com.apple.BluetoothSettings")
        .spawn();
    #[cfg(target_os = "linux")]
    let result = Command::new("blueman-manager")
        .spawn()
        .or_else(|_| {
            Command::new("gnome-control-center")
                .arg("bluetooth")
                .spawn()
        })
        .or_else(|_| Command::new("kcmshell6").arg("kcm_bluetooth").spawn())
        .or_else(|_| Command::new("kcmshell5").arg("kcm_bluetooth").spawn());
    result
        .map(|_| ())
        .map_err(|_| "Open Bluetooth settings from your system menu.".into())
}

pub async fn pair_native(id: String, mac: MacAddr6, model: DeviceModel) -> Result<(), String> {
    #[cfg(windows)]
    return tokio::time::timeout(
        Duration::from_secs(45),
        tokio::task::spawn_blocking(move || windows_api::pair(&id, mac, model)),
    )
    .await
    .map_err(|_| "Pairing timed out. Check for a Windows pairing prompt.".to_string())?
    .map_err(|error| error.to_string())?
    .map_err(|error| error.to_string());

    #[cfg(not(windows))]
    {
        let _ = (id, mac, model);
        Err("Pair your earbuds in system Bluetooth settings first.".into())
    }
}

#[cfg(windows)]
mod windows_api {
    use super::*;
    use anyhow::{Context, bail};
    use std::str::FromStr;
    use windows::{
        Devices::{
            Bluetooth::BluetoothDevice,
            Enumeration::{DeviceInformation, DeviceInformationKind, DevicePairingResultStatus},
            Radios::{Radio, RadioAccessStatus, RadioKind, RadioState},
        },
        Foundation::IPropertyValue,
        core::{HSTRING, Interface},
    };

    const ADDRESS: &str = "System.Devices.Aep.DeviceAddress";
    const CONNECTED: &str = "System.Devices.Aep.IsConnected";

    pub(super) fn discovery_properties() -> windows_collections::IIterable<HSTRING> {
        vec![HSTRING::from(ADDRESS), HSTRING::from(CONNECTED)].into()
    }

    fn property(info: &DeviceInformation, key: &str) -> Option<IPropertyValue> {
        info.Properties()
            .ok()?
            .Lookup(&HSTRING::from(key))
            .ok()?
            .cast()
            .ok()
    }

    fn address(info: &DeviceInformation) -> Option<MacAddr6> {
        let raw = property(info, ADDRESS)?.GetString().ok()?;
        let digits: String = raw
            .to_string_lossy()
            .chars()
            .filter(char::is_ascii_hexdigit)
            .collect();
        let value = u64::from_str_radix(&digits, 16).ok()?;
        if digits.len() != 12 || value == 0 {
            return None;
        }
        MacAddr6::from_str(&raw.to_string_lossy()).ok().or_else(|| {
            let bytes: [u8; 6] = value.to_be_bytes()[2..].try_into().ok()?;
            Some(MacAddr6::from(bytes))
        })
    }

    fn bluetooth_radios() -> windows::core::Result<Vec<Radio>> {
        Ok(Radio::GetRadiosAsync()?
            .join()?
            .into_iter()
            .filter(|radio| radio.Kind().ok() == Some(RadioKind::Bluetooth))
            .collect())
    }

    pub(super) async fn radio_state() -> &'static str {
        let Ok(operation) = Radio::GetRadiosAsync() else {
            return "unknown";
        };
        let radios = match tokio::time::timeout(Duration::from_secs(2), operation.clone()).await {
            Ok(Ok(radios)) => radios,
            Ok(Err(_)) => return "unknown",
            Err(_) => {
                let _ = operation.Cancel();
                return "unknown";
            }
        };
        let states: Vec<_> = radios
            .into_iter()
            .filter(|radio| radio.Kind().ok() == Some(RadioKind::Bluetooth))
            .filter_map(|radio| radio.State().ok())
            .collect();
        if states.contains(&RadioState::On) {
            "on"
        } else if states.contains(&RadioState::Off) {
            "off"
        } else {
            "unknown"
        }
    }

    pub(super) async fn find_paired_devices(
        deadline: Duration,
    ) -> anyhow::Result<Vec<DiscoveredDevice>> {
        let selector = BluetoothDevice::GetDeviceSelectorFromPairingState(true)?;
        let operation = {
            DeviceInformation::FindAllAsyncWithKindAqsFilterAndAdditionalProperties(
                &selector,
                &discovery_properties(),
                DeviceInformationKind::AssociationEndpoint,
            )?
        };
        let devices = match tokio::time::timeout(deadline, operation.clone()).await {
            Ok(result) => result?,
            Err(_) => {
                let _ = operation.Cancel();
                bail!("Bluetooth scan timed out. Put the earbuds in pairing mode and scan again.");
            }
        };
        Ok(devices
            .into_iter()
            .filter_map(|info| device_from_info(&info, true))
            .collect())
    }

    pub(super) fn device_from_info(
        info: &DeviceInformation,
        paired: bool,
    ) -> Option<DiscoveredDevice> {
        let mac = address(info)?;
        let name = info.Name().ok()?.to_string_lossy();
        let is_paired = info
            .Pairing()
            .and_then(|pairing| pairing.IsPaired())
            .unwrap_or(paired);
        let native_id = if is_paired {
            None
        } else {
            Some(info.Id().ok()?.to_string_lossy())
        };
        let mut device = DiscoveredDevice::soundcore(name, mac, is_paired, native_id)?;
        device.connected = property(info, CONNECTED)
            .and_then(|value| value.GetBoolean().ok())
            .unwrap_or(false);
        Some(device)
    }

    pub async fn connected_paired_devices() -> anyhow::Result<Vec<DiscoveredDevice>> {
        let mut devices = find_paired_devices(Duration::from_secs(4)).await?;
        devices.retain(|device| device.connected);
        Ok(devices)
    }

    pub async fn enable(app: &tauri::AppHandle) -> Result<(), String> {
        let (send, receive) = tokio::sync::oneshot::channel();
        app.run_on_main_thread(move || {
            let _ = send.send(Radio::RequestAccessAsync());
        })
        .map_err(|error| error.to_string())?;
        let access = receive
            .await
            .map_err(|error| error.to_string())?
            .map_err(|error| error.to_string())?;
        tokio::task::spawn_blocking(move || set_radio_on(access.join()?))
            .await
            .map_err(|error| error.to_string())?
            .map_err(|error| error.to_string())
    }

    fn set_radio_on(access: RadioAccessStatus) -> anyhow::Result<()> {
        let radios = bluetooth_radios()?;
        if radios
            .iter()
            .any(|radio| radio.State().ok() == Some(RadioState::On))
        {
            return Ok(());
        }
        let radio = radios
            .into_iter()
            .find(|radio| radio.State().ok() == Some(RadioState::Off))
            .context(
                "No Bluetooth radio that BudTune can turn on. Check Windows Bluetooth settings.",
            )?;
        if access != RadioAccessStatus::Allowed
            || radio.SetStateAsync(RadioState::On)?.join()? != RadioAccessStatus::Allowed
        {
            bail!(
                "Windows did not allow BudTune to turn on Bluetooth. Open Bluetooth settings to turn it on."
            );
        }
        Ok(())
    }

    pub fn pair(id: &str, expected_address: MacAddr6, model: DeviceModel) -> anyhow::Result<()> {
        let props: windows_collections::IIterable<HSTRING> = vec![HSTRING::from(ADDRESS)].into();
        let info = DeviceInformation::CreateFromIdAsyncWithKindAndAdditionalProperties(
            &HSTRING::from(id),
            &props,
            DeviceInformationKind::AssociationEndpoint,
        )?
        .join()?;
        if address(&info) != Some(expected_address) {
            bail!("The Bluetooth device changed. Scan again.");
        }
        let name = info.Name()?.to_string_lossy();
        let discovered = DiscoveredDevice::soundcore(name, expected_address, false, None)
            .context("Select a Soundcore audio device from the scan results.")?;
        if discovered.model.is_some_and(|detected| detected != model) {
            bail!("The selected profile does not match this Bluetooth device.");
        }
        let pairing = info.Pairing()?;
        if pairing.IsPaired()? {
            return Ok(());
        }
        let result = pairing.PairAsync()?.join()?.Status()?;
        if matches!(
            result,
            DevicePairingResultStatus::Paired | DevicePairingResultStatus::AlreadyPaired
        ) {
            return Ok(());
        }
        bail!(
            "Windows could not pair the device (status {}). Put it in pairing mode and try again.",
            result.0
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn distinguishes_similar_device_names() {
        assert_eq!(
            profile_for("soundcore R50i"),
            Some(DeviceModel::SoundcoreA3949)
        );
        assert_eq!(
            profile_for("Soundcore R50i NC"),
            Some(DeviceModel::SoundcoreA3959)
        );
        assert_eq!(profile_for("Soundcore Liberty 5 Pro"), None);
        assert_eq!(
            profile_for("soundcore Liberty 5"),
            Some(DeviceModel::SoundcoreA3957)
        );
        assert_eq!(profile_for("A3949"), Some(DeviceModel::SoundcoreA3949));
    }
}
