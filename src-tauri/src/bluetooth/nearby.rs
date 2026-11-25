use std::{collections::BTreeMap, time::Duration};

use anyhow::{Context, bail};
use tauri::ipc::Channel;
use tokio::sync::mpsc;
use windows::{
    Devices::{
        Bluetooth::BluetoothDevice,
        Enumeration::{
            DeviceInformation, DeviceInformationKind, DeviceInformationUpdate, DeviceWatcher,
            DeviceWatcherStatus,
        },
    },
    Foundation::TypedEventHandler,
    core::IInspectable,
};

use super::{DiscoveredDevice, Discovery, windows_api};

enum DeviceChange {
    Added(DeviceInformation),
    Updated(DeviceInformationUpdate),
    Removed(DeviceInformationUpdate),
    Stopped,
}

struct Watcher {
    device_watcher: DeviceWatcher,
    added: i64,
    updated: i64,
    removed: i64,
    stopped: i64,
}

impl Watcher {
    fn start() -> windows::core::Result<(Self, mpsc::UnboundedReceiver<DeviceChange>)> {
        // The unpaired Classic Bluetooth selector requests an active inquiry.
        let selector = BluetoothDevice::GetDeviceSelectorFromPairingState(false)?;
        let device_watcher =
            DeviceInformation::CreateWatcherWithKindAqsFilterAndAdditionalProperties(
                &selector,
                &windows_api::discovery_properties(),
                DeviceInformationKind::AssociationEndpoint,
            )?;
        let (send, receive) = mpsc::unbounded_channel();

        let added = device_watcher.Added(
            &TypedEventHandler::<DeviceWatcher, DeviceInformation>::new({
                let send = send.clone();
                move |_, info| {
                    if let Some(info) = info.as_ref() {
                        let _ = send.send(DeviceChange::Added(info.clone()));
                    }
                    Ok(())
                }
            }),
        )?;
        let updated = device_watcher.Updated(&TypedEventHandler::<
            DeviceWatcher,
            DeviceInformationUpdate,
        >::new({
            let send = send.clone();
            move |_, info| {
                if let Some(info) = info.as_ref() {
                    let _ = send.send(DeviceChange::Updated(info.clone()));
                }
                Ok(())
            }
        }))?;
        let removed = device_watcher.Removed(&TypedEventHandler::<
            DeviceWatcher,
            DeviceInformationUpdate,
        >::new({
            let send = send.clone();
            move |_, info| {
                if let Some(info) = info.as_ref() {
                    let _ = send.send(DeviceChange::Removed(info.clone()));
                }
                Ok(())
            }
        }))?;
        let stopped = device_watcher.Stopped(
            &TypedEventHandler::<DeviceWatcher, IInspectable>::new(move |_, _| {
                let _ = send.send(DeviceChange::Stopped);
                Ok(())
            }),
        )?;
        let watcher = Self {
            device_watcher,
            added,
            updated,
            removed,
            stopped,
        };
        watcher.device_watcher.Start()?;
        Ok((watcher, receive))
    }
}

impl Drop for Watcher {
    fn drop(&mut self) {
        if matches!(
            self.device_watcher.Status(),
            Ok(DeviceWatcherStatus::Started | DeviceWatcherStatus::EnumerationCompleted)
        ) {
            let _ = self.device_watcher.Stop();
        }
        let _ = self.device_watcher.RemoveAdded(self.added);
        let _ = self.device_watcher.RemoveUpdated(self.updated);
        let _ = self.device_watcher.RemoveRemoved(self.removed);
        let _ = self.device_watcher.RemoveStopped(self.stopped);
    }
}

#[derive(Default)]
struct Devices {
    endpoints: BTreeMap<String, DeviceInformation>,
    nearby: BTreeMap<String, DiscoveredDevice>,
    paired: Vec<DiscoveredDevice>,
}

impl Devices {
    fn apply(&mut self, change: DeviceChange) -> windows::core::Result<()> {
        let endpoint = match change {
            DeviceChange::Added(info) => {
                let id = info.Id()?.to_string_lossy();
                self.endpoints.insert(id.clone(), info);
                id
            }
            DeviceChange::Updated(update) => {
                let id = update.Id()?.to_string_lossy();
                let Some(endpoint) = self.endpoints.get(&id) else {
                    return Ok(());
                };
                endpoint.Update(&update)?;
                id
            }
            DeviceChange::Removed(update) => {
                let id = update.Id()?.to_string_lossy();
                self.endpoints.remove(&id);
                self.nearby.remove(&id);
                return Ok(());
            }
            DeviceChange::Stopped => return Ok(()),
        };
        if let Some(device) = self
            .endpoints
            .get(&endpoint)
            .and_then(|info| windows_api::device_from_info(info, false))
        {
            self.nearby.insert(endpoint, device);
        } else {
            self.nearby.remove(&endpoint);
        }
        Ok(())
    }

    fn snapshot(&self) -> Vec<DiscoveredDevice> {
        let mut unique: BTreeMap<_, _> = self
            .paired
            .iter()
            .map(|device| (&device.mac_address, device))
            .collect();
        unique.extend(
            self.nearby
                .values()
                .map(|device| (&device.mac_address, device)),
        );
        unique.into_values().cloned().collect()
    }
}

pub(super) async fn discover(updates: Channel<Vec<DiscoveredDevice>>) -> anyhow::Result<Discovery> {
    let radio = windows_api::radio_state().await;
    if radio == "off" {
        return Ok(Discovery {
            devices: Vec::new(),
            radio,
            can_enable: true,
        });
    }

    let (_watcher, mut changes) =
        Watcher::start().context("Windows could not start the nearby Bluetooth scan")?;
    let deadline = tokio::time::sleep(Duration::from_secs(20));
    let paired = windows_api::find_paired_devices(Duration::from_secs(5));
    tokio::pin!(deadline, paired);
    let mut paired_ready = false;
    let mut devices = Devices::default();
    let mut shown = Vec::new();
    loop {
        tokio::select! {
            _ = &mut deadline => break,
            result = &mut paired, if !paired_ready => {
                paired_ready = true;
                devices.paired = result.unwrap_or_default();
            }
            change = changes.recv() => match change {
                Some(DeviceChange::Stopped) | None => bail!("Windows stopped the nearby Bluetooth scan. Check Bluetooth settings and scan again."),
                Some(change) => { let _ = devices.apply(change); }
            }
        }
        let current = devices.snapshot();
        if shown != current {
            updates.send(current.clone())?;
            shown = current;
        }
    }
    Ok(Discovery {
        devices: shown,
        radio,
        can_enable: true,
    })
}
