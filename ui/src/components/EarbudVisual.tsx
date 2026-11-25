import { motion } from "framer-motion";
import { Battery, Bluetooth, Headphones, Radio, Zap } from "lucide-react";
import type { BatteryReading, DeviceSnapshot } from "../types";

function BatteryCell({ label, reading }: { label: string; reading: BatteryReading | null }) {
  return (
    <div className="bt-battery">
      <div className="flex items-center justify-between gap-2">
        <span className="bt-muted font-medium">{label}</span>
        {reading?.charging && <Zap className="size-4 text-[#f5c268]" aria-label="Charging" />}
      </div>
      {reading ? (
        <>
          <strong className="bt-battery-value">{reading.percent}%</strong>
          <div className="bt-battery-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={reading.percent}>
            <motion.div initial={false} animate={{ width: `${reading.percent}%` }} transition={{ duration: 0.4 }} className={reading.percent <= 20 ? "bt-battery-low" : ""} />
          </div>
        </>
      ) : (
        <span className="bt-battery-unavailable">Not reported</span>
      )}
    </div>
  );
}

export function EarbudVisual({ snapshot, ambientMode }: { snapshot: DeviceSnapshot; ambientMode: string | null }) {
  const { model, modelName, connected, battery } = snapshot;
  const overEar = /^SoundcoreA30/.test(model);
  const speaker = /^SoundcoreA31/.test(model);
  const showSides = !speaker && !overEar && (battery.left !== null || battery.right !== null);
  return (
    <section className="bt-overview" aria-label="Device overview">
      <div className="bt-overview-hero">
        <div className="bt-overview-copy">
          <span className="bt-connection"><i />{connected ? "Connected" : "Connecting"}</span>
          <h2>{modelName}</h2>
          <p className="bt-muted">{model.replace(/^Soundcore/, "")}{ambientMode ? ` · ${ambientMode}` : ""}</p>
        </div>
        <div className="bt-device-placeholder" aria-hidden="true">
          {speaker ? <Radio /> : overEar ? <Headphones /> : <Bluetooth />}
        </div>
      </div>
      <div className="bt-battery-title"><Battery className="size-4" /> Battery levels</div>
      <div className="bt-batteries">
        {showSides ? (
          <>
            <BatteryCell label="Left earbud" reading={battery.left} />
            <BatteryCell label="Right earbud" reading={battery.right} />
            <BatteryCell label="Charging case" reading={battery.case} />
          </>
        ) : (
          <>
            <BatteryCell label="Device" reading={battery.device} />
            {battery.case && <BatteryCell label="Charging case" reading={battery.case} />}
          </>
        )}
      </div>
    </section>
  );
}

