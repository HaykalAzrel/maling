import { useEffect, useState } from "react";
import { Device } from "../types/device";

export const OFFLINE_TIMEOUT_MS = 30_000; // 30 detik

/** Pure helper — bisa dipakai di luar hook */
export const isDeviceAlive = (device: Device): boolean =>
  Date.now() - (device.lastSeen ?? 0) < OFFLINE_TIMEOUT_MS;

/**
 * Reaktif: return true jika lastSeen device < 30 detik yang lalu.
 * Re-evaluasi setiap 1 detik. Reset interval otomatis jika lastSeen
 * berubah (artinya device kirim heartbeat → langsung jadi alive lagi).
 */
export function useDeviceAlive(device: Device | undefined): boolean {
  const [alive, setAlive] = useState<boolean>(
    () => (device ? isDeviceAlive(device) : false)
  );

  useEffect(() => {
    const lastSeen = device?.lastSeen ?? 0;
    const check = () => setAlive(Date.now() - lastSeen < OFFLINE_TIMEOUT_MS);

    check(); // cek langsung
    const id = setInterval(check, 1_000);
    return () => clearInterval(id);
  }, [device?.lastSeen]); // re-run setiap lastSeen berubah di Firebase

  return alive;
}