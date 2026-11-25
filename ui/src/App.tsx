import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bluetooth,
  Gamepad2,
  Headphones,
  Loader2,
  Plus,
  Power,
  Settings2,
  Sliders,
  Trash2,
  Waves,
} from "lucide-react";
import { api } from "./api";
import { AddDeviceModal } from "./components/AddDeviceModal";
import { AmbientStudio } from "./components/AmbientStudio";
import { EarbudVisual } from "./components/EarbudVisual";
import { BluetoothRadar } from "./components/BluetoothRadar";
import { EqualizerStudio } from "./components/EqualizerStudio";
import { GenericSettingControl } from "./components/GenericSettingControl";
import type {
  DeviceModelInfo,
  DeviceSnapshot,
  PairedDeviceInfo,
  QuickPreset,
  SettingEntry,
  SettingValue,
} from "./types";

type NavTab =
  | "devices"
  | "overview"
  | "ambient"
  | "equalizer"
  | "controls"
  | "more";

function findSetting(
  snapshot: DeviceSnapshot | null,
  id: string,
): SettingEntry | undefined {
  if (!snapshot) return undefined;
  for (const cat of snapshot.categories) {
    const found = cat.settings.find((s) => s.id === id);
    if (found) return found;
  }
  return undefined;
}

function settingText(entry: SettingEntry | undefined): string | null {
  if (!entry) return null;
  const s = entry.setting;
  if (s.type === "information") return s.translatedValue || s.value;
  if (s.type === "select") {
    const idx = s.setting.options.indexOf(s.value);
    return idx >= 0 ? s.setting.localizedOptions[idx] : s.value;
  }
  if (s.type === "toggle") return s.value ? "On" : "Off";
  return null;
}

export function App() {
  const [models, setModels] = useState<DeviceModelInfo[]>([]);
  const [paired, setPaired] = useState<PairedDeviceInfo[]>([]);
  const [snapshot, setSnapshot] = useState<DeviceSnapshot | null>(null);
  const [quickPresets, setQuickPresets] = useState<QuickPreset[]>([]);
  const [tab, setTab] = useState<NavTab>("devices");
  const activeMac = useRef<string | null>(null);
  const [connectingMac, setConnectingMac] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [toast, setToast] = useState<{ text: string; kind: "ok" | "err" } | null>(
    null,
  );

  const showToast = useCallback((text: string, kind: "ok" | "err" = "ok") => {
    setToast({ text, kind });
    setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 3200);
  }, []);

  const refreshPaired = useCallback(async () => {
    try {
      const list = await api.listPairedDevices();
      setPaired(list);
    } catch (err) {
      showToast(String(err), "err");
    }
  }, [showToast]);

  useEffect(() => {
    let disposed = false;
    void api.listDeviceModels().then(setModels).catch(() => {});
    void refreshPaired();
    void api
      .getDeviceSnapshot()
      .then((snap) => {
        if (!disposed && snap && !activeMac.current) {
          activeMac.current = snap.macAddress;
          setSnapshot(snap);
          setTab("overview");
          void api.listQuickPresets().then(setQuickPresets).catch(() => {});
        }
      })
      .catch(() => {});

    let unlistenUpdate: (() => void) | undefined;
    let unlistenDisconnect: (() => void) | undefined;

    void api
      .onDeviceUpdated((snap) => {
        if (!disposed && activeMac.current === snap.macAddress) setSnapshot(snap);
      })
      .then((fn) => {
        if (disposed) fn();
        else unlistenUpdate = fn;
      })
      .catch(() => {});
    void api
      .onDeviceDisconnected((mac) => {
        if (disposed || activeMac.current !== mac) return;
        activeMac.current = null;
        setSnapshot(null);
        setQuickPresets([]);
        setTab("devices");
        showToast("Device disconnected", "err");
      })
      .then((fn) => {
        if (disposed) fn();
        else unlistenDisconnect = fn;
      })
      .catch(() => {});

    return () => {
      disposed = true;
      unlistenUpdate?.();
      unlistenDisconnect?.();
    };
  }, [refreshPaired, showToast]);

  const handleConnect = async (mac: string, showErrorInline = false) => {
    activeMac.current = mac;
    setSnapshot(null);
    setQuickPresets([]);
    setConnectingMac(mac);
    try {
      const snap = await api.connectDevice(mac);
      if (activeMac.current !== mac) throw new Error("The device disconnected during setup. Try connecting again.");
      setSnapshot((current) => current ?? snap);
      setTab("overview");
      const presets = await api.listQuickPresets().catch(() => []);
      if (activeMac.current === mac) setQuickPresets(presets);
    } catch (err) {
      activeMac.current = null;
      setSnapshot(null);
      setTab("devices");
      if (showErrorInline) throw err;
      showToast(String(err), "err");
    } finally {
      setConnectingMac(null);
    }
  };

  const handleDisconnect = async () => {
    await api.disconnectDevice();
    activeMac.current = null;
    setSnapshot(null);
    setQuickPresets([]);
    setTab("devices");
  };

  const handleUpdateSetting = async (settingId: string, value: SettingValue) => {
    try {
      const updated = await api.setSettingValues([{ settingId, value }]);
      setSnapshot(updated);
    } catch (err) {
      showToast(String(err), "err");
    }
  };

  const handleSavePreset = async () => {
    const trimmed = presetName.trim();
    if (!trimmed) return;
    try {
      const next = await api.saveQuickPreset(trimmed);
      setQuickPresets(next);
      setPresetName("");
      showToast(`Saved "${trimmed}"`);
    } catch (err) {
      showToast(String(err), "err");
    }
  };

  const categoriesById = useMemo(() => {
    const map = new Map<string, SettingEntry[]>();
    if (!snapshot) return map;
    for (const c of snapshot.categories) {
      map.set(c.id, c.settings);
    }
    return map;
  }, [snapshot]);

  const soundModesEntries = categoriesById.get("soundModes") ?? [];
  const equalizerEntries = [
    ...(categoriesById.get("equalizer") ?? []),
    ...(categoriesById.get("equalizerImportExport") ?? []),
  ];
  const buttonEntries = categoriesById.get("buttonConfiguration") ?? [];
  const generalEntries = categoriesById.get("general") ?? [];
  const infoEntries = categoriesById.get("deviceInformation") ?? [];
  const otherCategories = useMemo(() => {
    if (!snapshot) return [];
    const dedicated = new Set([
      "soundModes",
      "equalizer",
      "equalizerImportExport",
      "buttonConfiguration",
    ]);
    return snapshot.categories.filter(
      (c) => !dedicated.has(c.id) && c.settings.length > 0,
    );
  }, [snapshot]);

  // Group button controls cleanly into Left / Right / Other (like Soundcore & OpenSCQ30)
  const leftButtons = buttonEntries.filter((b) =>
    b.id.toLowerCase().startsWith("left"),
  );
  const rightButtons = buttonEntries.filter((b) =>
    b.id.toLowerCase().startsWith("right"),
  );
  const sharedButtons = buttonEntries.filter(
    (b) =>
      !b.id.toLowerCase().startsWith("left") &&
      !b.id.toLowerCase().startsWith("right"),
  );

  const ambientModeEntry = findSetting(snapshot, "ambientSoundMode");
  const ambientModeLabel = settingText(ambientModeEntry);

  const navItems: {
    id: NavTab;
    label: string;
    icon: typeof Headphones;
    visible: boolean;
  }[] = [
    { id: "overview", label: "Overview", icon: Headphones, visible: !!snapshot },
    {
      id: "ambient",
      label: "Sound Modes",
      icon: Waves,
      visible: !!snapshot && soundModesEntries.length > 0,
    },
    {
      id: "equalizer",
      label: "Equalizer",
      icon: Sliders,
      visible: !!snapshot && equalizerEntries.length > 0,
    },
    {
      id: "controls",
      label: "Controls",
      icon: Gamepad2,
      visible: !!snapshot && buttonEntries.length > 0,
    },
    {
      id: "more",
      label: "Settings",
      icon: Settings2,
      visible: !!snapshot,
    },
    { id: "devices", label: "Devices", icon: Bluetooth, visible: true },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#111316] text-[#f3f4f6]">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-[#2b313b] bg-[#16191e] p-3">
        <div className="px-2.5 py-2">
          <h1 className="text-base font-semibold tracking-tight text-[#f3f4f6]">
            BudTune
          </h1>
        </div>

        {snapshot && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-[6px] border border-[#2b313b] bg-[#1c2026] px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-[#f3f4f6]">
                {snapshot.modelName}
              </div>
              <div className="text-[11px] text-[#9ca3af]">Connected</div>
            </div>
            <button
              type="button"
              onClick={() => void handleDisconnect()}
              title="Disconnect"
              className="rounded-[6px] p-1.5 text-[#9ca3af] hover:bg-[#242932] hover:text-[#f3f4f6]"
            >
              <Power className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <nav className="mt-3 flex-1 space-y-0.5">
          {navItems
            .filter((n) => n.visible)
            .map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`relative flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-[13px] font-medium transition-colors ${
                    active
                      ? "text-[#f3f4f6]"
                      : "text-[#9ca3af] hover:bg-[#1c2026] hover:text-[#f3f4f6]"
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="sidebar-nav-pill"
                      transition={{ type: "spring", stiffness: 460, damping: 36 }}
                      className="absolute inset-0 rounded-[6px] border border-[#2b313b] bg-[#242932]"
                    />
                  )}
                  <Icon className="relative z-10 h-4 w-4" />
                  <span className="relative z-10">{item.label}</span>
                </button>
              );
            })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="wait">
          {tab === "devices" && (
            <motion.div
              key="devices"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
              className="mx-auto max-w-3xl space-y-5"
            >
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-2xl font-semibold tracking-tight text-[#f3f4f6]">
                  Devices
                </h2>
                <button
                  type="button"
                  disabled={!!connectingMac}
                  onClick={() => setAddOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#147d69] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#179179]"
                >
                  <Plus className="h-4 w-4" />
                  Scan devices
                </button>
              </div>

              {paired.length === 0 ? (
                <section className="bt-welcome">
                  <div className="bt-welcome-copy">
                    <h3>Connect your earbuds</h3>
                    <p>Choose Soundcore earbuds connected to this computer, or scan nearby to add a new device.</p>
                    <button type="button" className="bt-button bt-button--primary" onClick={() => setAddOpen(true)} disabled={!!connectingMac}>
                      <Bluetooth className="size-4" /> Scan for earbuds
                    </button>
                  </div>
                  <div className="bt-device-placeholder"><BluetoothRadar /></div>
                </section>
              ) : (
                <div className="divide-y divide-[#2b313b] rounded-[8px] border border-[#2b313b] bg-[#1c2026]">
                  {paired.map((dev) => {
                    const isConnecting = connectingMac === dev.macAddress;
                    const isConnected =
                      snapshot?.macAddress.toLowerCase() ===
                      dev.macAddress.toLowerCase();
                    return (
                      <div
                        key={dev.macAddress}
                        className="flex items-center justify-between gap-4 px-4 py-3.5"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-semibold text-[#f3f4f6]">
                              {dev.modelName}
                            </span>
                          </div>
                          <div className="mt-0.5 font-mono text-xs text-[#6b7280]">
                            {dev.macAddress}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={!!connectingMac}
                            onClick={async () => {
                              try {
                                await api.unpairDevice(dev.macAddress);
                                if (activeMac.current === dev.macAddress) {
                                  activeMac.current = null;
                                  setSnapshot(null);
                                  setQuickPresets([]);
                                }
                                await refreshPaired();
                              } catch (err) {
                                showToast(String(err), "err");
                              }
                            }}
                            title="Remove"
                            className="rounded-[6px] border border-[#2b313b] bg-[#16191e] p-2 text-[#9ca3af] hover:text-[#f87171]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>

                          {isConnected ? (
                            <button
                              type="button"
                              onClick={() => setTab("overview")}
                              className="rounded-[6px] border border-[#3a4250] bg-[#242932] px-3.5 py-2 text-xs font-semibold text-[#f3f4f6]"
                            >
                              Open
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={!!connectingMac}
                              onClick={() => void handleConnect(dev.macAddress)}
                              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#147d69] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#179179] disabled:opacity-60"
                            >
                              {isConnecting && (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              )}
                              {isConnecting ? "Connecting" : "Connect"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {tab === "overview" && snapshot && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
              className="mx-auto max-w-3xl space-y-5"
            >
              <EarbudVisual snapshot={snapshot} ambientMode={ambientModeLabel} />

              {soundModesEntries.length > 0 && (
                <AmbientStudio
                  entries={soundModesEntries.slice(0, 1)}
                  onUpdate={handleUpdateSetting}
                />
              )}

              {generalEntries.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-[15px] font-semibold text-[#f3f4f6]">
                    General
                  </h3>
                  <div className="divide-y divide-[#2b313b] rounded-[8px] border border-[#2b313b] bg-[#1c2026]">
                    {generalEntries.map((entry) => (
                      <div key={entry.id} className="px-4 py-3">
                        <GenericSettingControl
                          entry={entry}
                          onUpdate={handleUpdateSetting}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="space-y-2">
                <h3 className="text-[15px] font-semibold text-[#f3f4f6]">
                  Quick Presets
                </h3>
                <div className="rounded-[8px] border border-[#2b313b] bg-[#1c2026] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {quickPresets.map((qp) => (
                      <div
                        key={qp.name}
                        className="inline-flex items-center gap-1 rounded-[6px] border border-[#2b313b] bg-[#16191e] pl-2.5 pr-1 py-1"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            void api
                              .activateQuickPreset(qp.name)
                              .then((s) => {
                                setSnapshot(s);
                                showToast(`Activated "${qp.name}"`);
                              })
                              .catch((e) => showToast(String(e), "err"))
                          }
                          className="text-xs font-medium text-[#f3f4f6] hover:underline"
                        >
                          {qp.name}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void api
                              .deleteQuickPreset(qp.name)
                              .then(setQuickPresets)
                          }
                          className="rounded-[4px] p-1 text-[#6b7280] hover:text-[#f87171]"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <div className="flex min-w-[180px] flex-1 gap-2">
                      <input
                        type="text"
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        placeholder="New preset name"
                        className="w-full rounded-[6px] border border-[#2b313b] bg-[#16191e] px-2.5 py-1.5 text-xs text-[#f3f4f6] placeholder-[#6b7280] outline-none focus:border-[#147d69]"
                      />
                      <button
                        type="button"
                        onClick={() => void handleSavePreset()}
                        className="rounded-[6px] border border-[#2b313b] bg-[#242932] px-3 py-1.5 text-xs font-medium text-[#f3f4f6] hover:bg-[#2d333d]"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {infoEntries.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-[15px] font-semibold text-[#f3f4f6]">
                    Device Info
                  </h3>
                  <div className="divide-y divide-[#2b313b] rounded-[8px] border border-[#2b313b] bg-[#1c2026]">
                    {infoEntries.slice(0, 4).map((entry) => (
                      <div key={entry.id} className="px-4 py-2.5">
                        <GenericSettingControl
                          entry={entry}
                          onUpdate={handleUpdateSetting}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </motion.div>
          )}

          {tab === "ambient" && snapshot && (
            <motion.div
              key="ambient"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
              className="mx-auto max-w-3xl space-y-5"
            >
              <h2 className="text-2xl font-semibold tracking-tight text-[#f3f4f6]">
                Sound Modes
              </h2>
              <AmbientStudio
                entries={soundModesEntries}
                onUpdate={handleUpdateSetting}
              />
            </motion.div>
          )}

          {tab === "equalizer" && snapshot && (
            <motion.div
              key="equalizer"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
              className="mx-auto max-w-3xl space-y-5"
            >
              <h2 className="text-2xl font-semibold tracking-tight text-[#f3f4f6]">
                Equalizer
              </h2>
              <EqualizerStudio
                entries={equalizerEntries}
                onUpdate={handleUpdateSetting}
              />
            </motion.div>
          )}

          {tab === "controls" && snapshot && (
            <motion.div
              key="controls"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
              className="mx-auto max-w-3xl space-y-5"
            >
              <h2 className="text-2xl font-semibold tracking-tight text-[#f3f4f6]">
                Controls
              </h2>
              {(leftButtons.length > 0 || rightButtons.length > 0) && (
                <div className="grid gap-4 md:grid-cols-2">
                  {leftButtons.length > 0 && (
                    <section className="space-y-2">
                      <h3 className="text-[15px] font-semibold text-[#f3f4f6]">
                        Left Earbud
                      </h3>
                      <div className="divide-y divide-[#2b313b] rounded-[8px] border border-[#2b313b] bg-[#1c2026]">
                        {leftButtons.map((entry) => (
                          <div key={entry.id} className="px-4 py-3">
                            <GenericSettingControl
                              entry={entry}
                              onUpdate={handleUpdateSetting}
                            />
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  {rightButtons.length > 0 && (
                    <section className="space-y-2">
                      <h3 className="text-[15px] font-semibold text-[#f3f4f6]">
                        Right Earbud
                      </h3>
                      <div className="divide-y divide-[#2b313b] rounded-[8px] border border-[#2b313b] bg-[#1c2026]">
                        {rightButtons.map((entry) => (
                          <div key={entry.id} className="px-4 py-3">
                            <GenericSettingControl
                              entry={entry}
                              onUpdate={handleUpdateSetting}
                            />
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}

              {sharedButtons.length > 0 && (
                <div className="divide-y divide-[#2b313b] rounded-[8px] border border-[#2b313b] bg-[#1c2026]">
                  {sharedButtons.map((entry) => (
                    <div key={entry.id} className="px-4 py-3">
                      <GenericSettingControl
                        entry={entry}
                        onUpdate={handleUpdateSetting}
                      />
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {tab === "more" && snapshot && (
            <motion.div
              key="more"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
              className="mx-auto max-w-3xl space-y-5"
            >
              <h2 className="text-2xl font-semibold tracking-tight text-[#f3f4f6]">
                Settings
              </h2>
              {otherCategories.map((cat) => (
                <section key={cat.id} className="space-y-2">
                  <h3 className="text-[15px] font-semibold text-[#f3f4f6]">
                    {cat.label}
                  </h3>
                  <div className="divide-y divide-[#2b313b] rounded-[8px] border border-[#2b313b] bg-[#1c2026]">
                    {cat.settings.map((entry) => (
                      <div key={entry.id} className="px-4 py-3">
                        <GenericSettingControl
                          entry={entry}
                          onUpdate={handleUpdateSetting}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AddDeviceModal
        open={addOpen}
        models={models}
        onClose={() => setAddOpen(false)}
        onPairedAndConnect={(mac) => {
          void refreshPaired();
          return handleConnect(mac, true);
        }}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className={`fixed right-5 bottom-5 z-50 rounded-[6px] border px-3.5 py-2.5 text-xs font-medium shadow-lg ${
              toast.kind === "err"
                ? "border-[#7f1d1d] bg-[#2a1515] text-[#fca5a5]"
                : "border-[#2b313b] bg-[#1c2026] text-[#f3f4f6]"
            }`}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
