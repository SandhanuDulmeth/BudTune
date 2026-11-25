import { useRef, useState } from "react";
import type { EqualizerSpec, SettingEntry, SettingValue } from "../types";
import { GenericSettingControl } from "./GenericSettingControl";

interface EqualizerStudioProps {
  entries: SettingEntry[];
  onUpdate: (settingId: string, value: SettingValue) => void;
}

function formatHz(hz: number): string {
  return hz >= 1000
    ? `${(hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1)}k`
    : `${hz}`;
}

function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cx = (p0.x + p1.x) / 2;
    d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

function InteractiveEqCurve({
  spec,
  values,
  readOnly,
  onChange,
}: {
  spec: EqualizerSpec;
  values: number[];
  readOnly: boolean;
  onChange: (next: number[]) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  const width = 680;
  const height = 220;
  const padX = 36;
  const padY = 26;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const divisor = Math.pow(10, spec.fractionDigits);
  const count = Math.max(1, values.length);

  const points = values.map((val, i) => {
    const x = padX + (count === 1 ? innerW / 2 : (i / (count - 1)) * innerW);
    const ratio = (val - spec.min) / Math.max(1, spec.max - spec.min);
    const y = padY + (1 - ratio) * innerH;
    return { x, y, val };
  });

  const linePath = buildSmoothPath(points);

  const updateFromPointer = (clientY: number, index: number) => {
    if (readOnly || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relY = ((clientY - rect.top) / rect.height) * height;
    const clampedY = Math.min(height - padY, Math.max(padY, relY));
    const ratio = 1 - (clampedY - padY) / innerH;
    const raw = Math.round(spec.min + ratio * (spec.max - spec.min));
    const next = [...values];
    next[index] = Math.min(spec.max, Math.max(spec.min, raw));
    onChange(next);
  };

  return (
    <div className="rounded-[6px] border border-[#2b313b] bg-[#16191e] p-3 select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full overflow-visible"
        onPointerMove={(e) => {
          if (draggingIdx !== null) updateFromPointer(e.clientY, draggingIdx);
        }}
        onPointerUp={() => setDraggingIdx(null)}
        onPointerLeave={() => setDraggingIdx(null)}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padY + t * innerH;
          const isZero = t === 0.5;
          return (
            <line
              key={t}
              x1={padX}
              x2={width - padX}
              y1={y}
              y2={y}
              stroke={isZero ? "#3f4756" : "#242932"}
              strokeDasharray={isZero ? "4 4" : undefined}
              strokeWidth={1}
            />
          );
        })}

        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="#147d69"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        )}

        {points.map((pt, i) => {
          const db = (pt.val / divisor).toFixed(
            spec.fractionDigits > 0 ? 1 : 0,
          );
          const active = draggingIdx === i;
          return (
            <g key={i}>
              <line
                x1={pt.x}
                x2={pt.x}
                y1={padY}
                y2={height - padY}
                stroke="#242932"
                strokeWidth={1}
              />
              <circle
                cx={pt.x}
                cy={pt.y}
                r={active ? 8 : 6}
                fill="#1c2026"
                stroke={readOnly ? "#6b7280" : "#147d69"}
                strokeWidth={active ? 3 : 2}
                className={readOnly ? "cursor-default" : "cursor-ns-resize"}
                onPointerDown={(e) => {
                  if (readOnly) return;
                  (e.target as Element).setPointerCapture(e.pointerId);
                  setDraggingIdx(i);
                }}
              />
              <text
                x={pt.x}
                y={pt.y - 12}
                textAnchor="middle"
                className="fill-[#e5e7eb] font-mono text-[10px] font-medium tabular-nums"
              >
                {Number(db) > 0 ? `+${db}` : db}
              </text>
              <text
                x={pt.x}
                y={height - 4}
                textAnchor="middle"
                className="fill-[#9ca3af] font-mono text-[10px] tabular-nums"
              >
                {spec.bandHz[i] ? formatHz(spec.bandHz[i]) : `#${i + 1}`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function EqualizerStudio({ entries, onUpdate }: EqualizerStudioProps) {
  const presetEntry = entries.find(
    (e) =>
      e.id === "presetEqualizerProfile" ||
      e.setting.type === "presetEqualizerProfileSelect",
  );
  const customProfileEntry = entries.find(
    (e) => e.id === "customEqualizerProfile",
  );
  const eqEntry = entries.find(
    (e) => e.id === "volumeAdjustments" || e.setting.type === "equalizer",
  );
  const otherEntries = entries.filter(
    (e) => e !== presetEntry && e !== customProfileEntry && e !== eqEntry,
  );

  return (
    <div className="space-y-4">
      {eqEntry && eqEntry.setting.type === "equalizer" && (
        <div className="rounded-[8px] border border-[#2b313b] bg-[#1c2026] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold text-[#f3f4f6]">
                {eqEntry.label}
              </h3>
              <p className="text-xs text-[#9ca3af]">
                {eqEntry.setting.readOnly
                  ? "Select a custom profile to edit."
                  : "Drag points to adjust bands."}
              </p>
            </div>
            {!eqEntry.setting.readOnly && (
              <button
                type="button"
                onClick={() => {
                  if (eqEntry.setting.type !== "equalizer") return;
                  const mid = Math.round(
                    (eqEntry.setting.setting.min + eqEntry.setting.setting.max) /
                      2,
                  );
                  onUpdate(eqEntry.id, {
                    type: "i16Vec",
                    value: eqEntry.setting.value.map(() => mid),
                  });
                }}
                className="rounded-[6px] border border-[#2b313b] bg-[#242932] px-3 py-1.5 text-xs font-medium text-[#f3f4f6] hover:bg-[#2d333d]"
              >
                Reset
              </button>
            )}
          </div>

          <InteractiveEqCurve
            spec={eqEntry.setting.setting}
            values={eqEntry.setting.value}
            readOnly={eqEntry.setting.readOnly}
            onChange={(next) =>
              onUpdate(eqEntry.id, { type: "i16Vec", value: next })
            }
          />
        </div>
      )}

      {presetEntry &&
        presetEntry.setting.type === "presetEqualizerProfileSelect" && (
          <div className="rounded-[8px] border border-[#2b313b] bg-[#1c2026] p-4">
            <h3 className="mb-3 text-[15px] font-semibold text-[#f3f4f6]">
              Presets
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {presetEntry.setting.select.options.map((opt, idx) => {
                const label =
                  presetEntry.setting.type === "presetEqualizerProfileSelect"
                    ? presetEntry.setting.select.localizedOptions[idx] ?? opt
                    : opt;
                const active =
                  presetEntry.setting.type === "presetEqualizerProfileSelect" &&
                  presetEntry.setting.value === opt;

                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() =>
                      onUpdate(presetEntry.id, {
                        type: "optionalString",
                        value: opt,
                      })
                    }
                    className={`rounded-[6px] border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "border-[#4b5563] bg-[#2c333d] text-[#f3f4f6]"
                        : "border-[#2b313b] bg-[#16191e] text-[#9ca3af] hover:text-[#f3f4f6]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

      {(customProfileEntry || otherEntries.length > 0) && (
        <div className="divide-y divide-[#2b313b] rounded-[8px] border border-[#2b313b] bg-[#1c2026]">
          {customProfileEntry && (
            <div className="px-4 py-3">
              <GenericSettingControl
                entry={customProfileEntry}
                onUpdate={onUpdate}
              />
            </div>
          )}
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
