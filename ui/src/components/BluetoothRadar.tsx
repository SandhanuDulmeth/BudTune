import { Bluetooth, LoaderCircle } from "lucide-react";

export function BluetoothRadar({ scanning = false }: { scanning?: boolean }) {
  return (
    <div className={`bt-radar${scanning ? " bt-radar--active" : ""}`} aria-hidden="true">
      <span className="bt-radar-ring" />
      <span className="bt-radar-ring" />
      <span className="bt-radar-ring" />
      <div className="bt-radar-center">
        {scanning ? <LoaderCircle className="size-7 animate-spin motion-reduce:animate-none" /> : <Bluetooth className="size-7" />}
      </div>
    </div>
  );
}
