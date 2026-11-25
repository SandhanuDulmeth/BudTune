import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { SettingEntry, SettingValue } from "../types";

interface GenericSettingControlProps {
  entry: SettingEntry;
  onUpdate: (settingId: string, value: SettingValue) => void;
}

export function GenericSettingControl({
  entry,
  onUpdate,
}: GenericSettingControlProps) {
  const { id, label, setting } = entry;
  const [newName, setNewName] = useState("");
  const [importText, setImportText] = useState("");

  if (setting.type === "toggle") {
    return (
      <div className="flex items-center justify-between gap-4 py-1">
        <span className="text-[13px] font-medium text-[#e5e7eb]">{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={setting.value}
          onClick={() => onUpdate(id, { type: "bool", value: !setting.value })}
          className={`relative h-6 w-11 shrink-0 rounded-[6px] border transition-colors ${
            setting.value
              ? "border-[#147d69] bg-[#147d69]"
              : "border-[#353c47] bg-[#242932]"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-4.5 w-4.5 rounded-[4px] bg-white transition-transform ${
              setting.value ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    );
  }

  if (setting.type === "i32Range") {
    return (
      <div className="space-y-2 py-1">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-[#e5e7eb]">{label}</span>
          <span className="rounded-[6px] border border-[#2b313b] bg-[#16191e] px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-[#f3f4f6]">
            {setting.value}
          </span>
        </div>
        <input
          type="range"
          min={setting.setting.start}
          max={setting.setting.end}
          step={setting.setting.step || 1}
          value={setting.value}
          onChange={(e) =>
            onUpdate(id, { type: "i32", value: Number(e.target.value) })
          }
          className="h-1.5 w-full cursor-pointer appearance-none rounded-[4px] bg-[#2c333d] accent-[#147d69]"
        />
      </div>
    );
  }

  if (setting.type === "select" || setting.type === "optionalSelect") {
    const isOptional = setting.type === "optionalSelect";
    return (
      <div className="flex items-center justify-between gap-4 py-1">
        <label className="text-[13px] font-medium text-[#e5e7eb]">{label}</label>
        <select
          value={setting.value ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            if (isOptional) {
              onUpdate(id, {
                type: "optionalString",
                value: v === "" ? null : v,
              });
            } else {
              onUpdate(id, { type: "string", value: v });
            }
          }}
          className="max-w-[240px] rounded-[6px] border border-[#2b313b] bg-[#16191e] px-2.5 py-1.5 text-[13px] text-[#f3f4f6] outline-none focus:border-[#147d69]"
        >
          {isOptional && <option value="">None</option>}
          {setting.setting.options.map((opt, idx) => (
            <option key={opt} value={opt}>
              {setting.setting.localizedOptions[idx] ?? opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (setting.type === "modifiableSelect") {
    return (
      <div className="space-y-2.5 py-1">
        <label className="block text-[13px] font-medium text-[#e5e7eb]">
          {label}
        </label>
        <div className="flex gap-2">
          <select
            value={setting.value ?? ""}
            onChange={(e) =>
              onUpdate(id, {
                type: "optionalString",
                value: e.target.value === "" ? null : e.target.value,
              })
            }
            className="flex-1 rounded-[6px] border border-[#2b313b] bg-[#16191e] px-2.5 py-1.5 text-[13px] text-[#f3f4f6] outline-none focus:border-[#147d69]"
          >
            <option value="">None</option>
            {setting.setting.options.map((opt, idx) => (
              <option key={opt} value={opt}>
                {setting.setting.localizedOptions[idx] ?? opt}
              </option>
            ))}
          </select>
          {setting.value && (
            <button
              type="button"
              onClick={() =>
                onUpdate(id, {
                  type: "modifiableSelectCommand",
                  value: { type: "remove", name: setting.value! },
                })
              }
              title="Delete profile"
              className="rounded-[6px] border border-[#2b313b] bg-[#242932] p-2 text-[#9ca3af] hover:text-[#f87171]"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Profile name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 rounded-[6px] border border-[#2b313b] bg-[#16191e] px-2.5 py-1.5 text-xs text-[#f3f4f6] placeholder-[#6b7280] outline-none focus:border-[#147d69]"
          />
          <button
            type="button"
            disabled={!newName.trim()}
            onClick={() => {
              onUpdate(id, {
                type: "modifiableSelectCommand",
                value: { type: "add", name: newName.trim() },
              });
              setNewName("");
            }}
            className="inline-flex items-center gap-1 rounded-[6px] border border-[#2b313b] bg-[#242932] px-3 py-1.5 text-xs font-medium text-[#f3f4f6] hover:bg-[#2d333d] disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Save
          </button>
        </div>
      </div>
    );
  }

  if (setting.type === "multiSelect" || setting.type === "multiSelectWithRemove") {
    return (
      <div className="space-y-2 py-1">
        <span className="block text-[13px] font-medium text-[#e5e7eb]">
          {label}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {setting.setting.options.map((opt, idx) => {
            const selected = setting.values.includes(opt);
            const text = setting.setting.localizedOptions[idx] ?? opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  if (setting.type === "multiSelectWithRemove") {
                    onUpdate(id, {
                      type: "multiSelectWithRemoveCommand",
                      value: { type: "remove", name: opt },
                    });
                  } else {
                    const next = selected
                      ? setting.values.filter((v) => v !== opt)
                      : [...setting.values, opt];
                    onUpdate(id, { type: "stringVec", value: next });
                  }
                }}
                className={`rounded-[6px] border px-2.5 py-1 text-xs font-medium transition-colors ${
                  selected
                    ? "border-[#4b5563] bg-[#2c333d] text-[#f3f4f6]"
                    : "border-[#2b313b] bg-[#16191e] text-[#9ca3af] hover:text-[#f3f4f6]"
                }`}
              >
                {text}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (setting.type === "information") {
    return (
      <div className="flex items-center justify-between gap-4 py-1">
        <span className="text-[13px] text-[#9ca3af]">{label}</span>
        <span className="font-mono text-xs font-medium tabular-nums text-[#f3f4f6]">
          {setting.translatedValue || setting.value}
        </span>
      </div>
    );
  }

  if (setting.type === "action") {
    return (
      <div className="flex items-center justify-between gap-4 py-1">
        <span className="text-[13px] font-medium text-[#e5e7eb]">{label}</span>
        <button
          type="button"
          onClick={() => onUpdate(id, { type: "bool", value: true })}
          className="rounded-[6px] border border-[#2b313b] bg-[#242932] px-3 py-1.5 text-xs font-medium text-[#f3f4f6] hover:bg-[#2d333d]"
        >
          Run
        </button>
      </div>
    );
  }

  if (setting.type === "hueColorPicker") {
    return (
      <div className="space-y-2 py-1">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-[#e5e7eb]">{label}</span>
          <span
            className="h-4 w-4 rounded-[4px] border border-[#3f4756]"
            style={{ backgroundColor: `hsl(${setting.hue}, 80%, 50%)` }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={360}
          value={setting.hue}
          onChange={(e) =>
            onUpdate(id, { type: "f32", value: Number(e.target.value) })
          }
          className="h-1.5 w-full cursor-pointer appearance-none rounded-[4px] bg-[#2c333d]"
        />
      </div>
    );
  }

  if (setting.type === "importString") {
    return (
      <div className="space-y-2 py-1">
        <span className="block text-[13px] font-medium text-[#e5e7eb]">
          {label}
        </span>
        <div className="flex gap-2">
          <input
            type="text"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Paste exported JSON"
            className="flex-1 rounded-[6px] border border-[#2b313b] bg-[#16191e] px-2.5 py-1.5 text-xs text-[#f3f4f6] placeholder-[#6b7280] outline-none focus:border-[#147d69]"
          />
          <button
            type="button"
            disabled={!importText.trim()}
            onClick={() => {
              onUpdate(id, { type: "string", value: importText.trim() });
              setImportText("");
            }}
            className="rounded-[6px] border border-[#2b313b] bg-[#242932] px-3 py-1.5 text-xs font-medium text-[#f3f4f6] hover:bg-[#2d333d] disabled:opacity-40"
          >
            Import
          </button>
        </div>
      </div>
    );
  }

  if (setting.type === "timeOfDay") {
    const hrs = Math.floor(setting.minutesAfterMidnight / 60);
    const mins = setting.minutesAfterMidnight % 60;
    const formatted = `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
    return (
      <div className="flex items-center justify-between gap-4 py-1">
        <span className="text-[13px] font-medium text-[#e5e7eb]">{label}</span>
        <input
          type="time"
          value={formatted}
          onChange={(e) => {
            const [h, m] = e.target.value.split(":").map(Number);
            if (!Number.isNaN(h) && !Number.isNaN(m)) {
              onUpdate(id, { type: "i32", value: h * 60 + m });
            }
          }}
          className="rounded-[6px] border border-[#2b313b] bg-[#16191e] px-2.5 py-1 text-xs text-[#f3f4f6]"
        />
      </div>
    );
  }

  return null;
}
