import { create } from "zustand";
import { Device } from "../types/device";

interface DeviceStore {
    devices: Record<string, Device>;

    setDevices: (devices: Record<string, Device>) => void;
}

export const useDeviceStore = create<DeviceStore>((set) => ({
    devices: {},

    setDevices: (devices) => set({ devices }),
}));