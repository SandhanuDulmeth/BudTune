import { motion } from "framer-motion";
import { Ear, Shield, Wind } from "lucide-react";
import type { SettingEntry, SettingValue } from "../types";
import { GenericSettingControl } from "./GenericSettingControl";

interface AmbientStudioProps {
  entries: SettingEntry[];
  onUpdate: (settingId: string, value: SettingValue) => void;
}

function getModeIcon(option: string) {
  const lower = option.toLowerCase();
  if (lower.includes("noise") || lower.includes("anc")) return Shield;
  if (lower.includes("transparen")) return Ear;
  return Wind;
}

export function AmbientStudio({ entries, onUpdate }: AmbientStudioProps) {
  const ambientEntry = entries.find((e) => e.id === "ambientSoundMode");
  const otherEntries = entries.filter((e) => e.id !== "ambientSoundMode");

  return (
    <div className="space-y-4">
      {ambientEntry && ambientEntry.setting.type === "select" && (
        <div className="rounded-[8px] border border-[#2b313b] bg-[#1c2026] p-4">
          <div className="mb-3 text-[13px] font-semibold text-[#f3f4f6]">
            {ambientEntry.label}
          </div>

          <div className="grid grid-cols-3 gap-1.5 rounded-[6px] border border-[#2b313b] bg-[#16191e] p-1">
            {ambientEntry.setting.setting.options.map((option, idx) => {
              const label =
                ambientEntry.setting.type === "select"
                  ? ambientEntry.setting.setting.localizedOptions[idx] ?? option
                  : option;
              const active =
                ambientEntry.setting.type === "select" &&
                ambientEntry.setting.value === option;
              const Icon = getModeIcon(option);

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    onUpdate(ambientEntry.id, { type: "string", value: option })
                  }
                  className="relative flex flex-col items-center gap-1 rounded-[6px] px-3 py-2.5 text-center transition-colors"
                >
                  {active && (
                    <motion.div
                      layoutId="ambient-mode-pill"
                      transition={{ type: "spring", stiffness: 460, damping: 36 }}
                      className="absolute inset-0 rounded-[6px] border border-[#3a4250] bg-[#242932]"
                    />
                  )}
                  <Icon
                    className={`relative z-10 h-4 w-4 ${
                      active ? "text-[#f3f4f6]" : "text-[#6b7280]"
                    }`}
                  />
                  <span
                    className={`relative z-10 text-xs font-medium ${
                      active ? "text-[#f3f4f6]" : "text-[#9ca3af]"
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {otherEntries.length > 0 && (
        <div className="divide-y divide-[#2b313b] rounded-[8px] border border-[#2b313b] bg-[#1c2026]">
          {otherEntries.map((entry) => (
            <div key={entry.id} className="px-4 py-3">
              <GenericSettingControl entry={entry} onUpdate={onUpdate} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
