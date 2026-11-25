import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Bluetooth, ChevronRight, Loader2, Power, RefreshCw, Settings2, Square, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../api";
import type { BluetoothDiscovery, DeviceModelInfo, DiscoveredDevice } from "../types";
import { BluetoothRadar } from "./BluetoothRadar";

interface AddDeviceModalProps {
  open: boolean;
  models: DeviceModelInfo[];
  onClose: () => void;
  onPairedAndConnect: (macAddress: string) => Promise<void>;
}

export function AddDeviceModal({ open, models, onClose, onPairedAndConnect }: AddDeviceModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef(0);
  const [report, setReport] = useState<BluetoothDiscovery | null>(null);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<DiscoveredDevice | null>(null);
  const [model, setModel] = useState("");

  const stopScan = useCallback(() => {
    const id = request.current++;
    setScanning(false);
    void api.stopBluetoothScan(id).catch(() => {});
  }, []);

  const scan = useCallback(async () => {
    const id = ++request.current;
    setScanning(true);
    setError("");
    setSelected(null);
    setReport((current) => current && { ...current, radio: "unknown", devices: current.devices.filter((device) => device.paired) });

    let available: BluetoothDiscovery | undefined;
    let nearby: BluetoothDiscovery | undefined;
    let scanFinished = false;

    function publish() {
      const next = nearby ?? available;
      if (!next || id !== request.current) return;
      const devices = new Map(nearby?.devices.map((device) => [device.macAddress, device]));
      for (const device of available?.devices ?? []) devices.set(device.macAddress, device);
      setReport({ ...next, devices: next.radio === "off" ? [] : [...devices.values()] });
    }

    const loadAvailable = api.listAvailableBluetooth().then((result) => {
      available = result;
      publish();
    }).then(() => null, (error: unknown) => String(error));

    try {
      nearby = await api.discoverBluetooth(id, (devices) => {
        if (scanFinished) return;
        nearby = { devices, radio: "on", canEnable: true };
        publish();
      });
      scanFinished = true;
      publish();
      const availableError = await loadAvailable;
      if (id === request.current && !nearby.canEnable && availableError) setError(availableError);
    } catch (err) {
      if (id === request.current) {
        setError(String(err));
      }
    } finally {
      scanFinished = true;
      if (id === request.current) setScanning(false);
    }
  }, []);

  useEffect(() => {
    const node = dialog.current;
    if (!open || !node) return;
    setModel("");
    setReport(null);
    node.showModal();
    void scan();
    return () => {
      stopScan();
      node.close();
    };
  }, [open, scan, stopScan]);

  async function add(device: DiscoveredDevice) {
    stopScan();
    setError("");
    const profile = device.model ?? (selected?.macAddress === device.macAddress ? model : "");
    if (!profile) {
      setSelected(device);
      setModel("");
      return;
    }
    setBusy(true);
    try {
      await api.pairDevice(device.macAddress, profile, device.paired ? null : device.nativeId);
      await onPairedAndConnect(device.macAddress);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function turnOnBluetooth() {
    setBusy(true);
    setError("");
    try {
      await api.enableBluetooth();
      void scan();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  const radioOff = report?.radio === "off";
  const savedDevices = report?.devices ?? [];

  return (
    <dialog
      ref={dialog}
      aria-labelledby="bluetooth-title"
      className="bt-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="bt-dialog-header">
        <div>
          <h2 id="bluetooth-title">Add a device</h2>
          <p>Choose your Soundcore earbuds or headphones.</p>
        </div>
        <button type="button" className="bt-icon-button" onClick={onClose} disabled={busy} aria-label="Close">
          <X className="size-5" />
        </button>
      </header>

      <div className="bt-dialog-content" aria-busy={busy}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={selected ? "profile" : "scan"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {!selected ? (
              <>
                <div className="bt-scan-panel">
                  <BluetoothRadar scanning={scanning} />
                  <div>
                    <h3 role="status">{radioOff ? "Bluetooth is off" : scanning ? "Scanning for nearby devices" : "Available devices"}</h3>
                    <p>{report && !report.canEnable
                      ? "Pair and connect your earbuds in system Bluetooth settings, then scan again."
                      : "Choose a connected device or put another device in pairing mode and scan nearby."}</p>
                  </div>
                </div>
                {radioOff && report.canEnable && (
                  <button className="bt-button bt-button--primary mt-4" type="button" disabled={busy} onClick={() => void turnOnBluetooth()}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Power className="size-4" />}
                    Turn on Bluetooth
                  </button>
                )}
                {!radioOff && (
                  <div className="mt-4 space-y-2">
                    {!scanning && savedDevices.length === 0 && !error && (
                      <p role="status" className="bt-muted">No Soundcore devices found. Put the earbuds in pairing mode and scan again.</p>
                    )}
                    {savedDevices.map((device) => (
                      <button key={device.macAddress} type="button" className="bt-result" disabled={busy} onClick={() => void add(device)}>
                        <span className="bt-result-icon"><Bluetooth className="size-4" /></span>
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate">{device.name}</strong>
                          <small>{device.connected ? "Connected to this computer" : device.paired ? "Paired in Bluetooth" : "Ready to pair"} · {device.macAddress.slice(-5)}</small>
                        </span>
                        {busy ? <Loader2 className="size-4 animate-spin" /> : <ChevronRight className="size-4" />}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <button className="bt-button" type="button" disabled={busy} onClick={() => { setSelected(null); setError(""); }}>
                  <ArrowLeft className="size-4" /> Back to devices
                </button>
                <div>
                  <h3 className="text-lg font-semibold">{selected.name}</h3>
                  <p className="bt-muted">Choose the exact model code printed on your earbuds or case. If it is absent, this model needs a new driver.</p>
                </div>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Device profile</span>
                  <select aria-label="Device profile" className="bt-select" value={model} disabled={busy} onChange={(event) => setModel(event.target.value)}>
                    <option value="">Select model</option>
                    {models.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.id.replace("Soundcore", "")}</option>)}
                  </select>
                </label>
                <button
                  type="button"
                  className="bt-button bt-button--primary"
                  disabled={!model || busy}
                  onClick={() => void add(selected)}
                >
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  Pair and connect
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        {error && <p role="alert" className="bt-error">{error}</p>}
      </div>

      {!selected && (
        <footer className="bt-dialog-footer">
          <button type="button" className="bt-button" disabled={busy} onClick={() => void api.openBluetoothSettings().catch((err) => setError(String(err)))}>
            <Settings2 className="size-4" /> Bluetooth settings
          </button>
          <button type="button" className="bt-button bt-button--primary ml-auto" disabled={busy} onClick={scanning ? stopScan : () => void scan()}>
            {scanning ? <Square className="size-4" /> : <RefreshCw className="size-4" />} {scanning ? "Stop scan" : report?.canEnable === false ? "Scan again" : "Scan nearby"}
          </button>
        </footer>
      )}
    </dialog>
  );
}

