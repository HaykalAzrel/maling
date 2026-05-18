import { useEffect, useMemo, useRef, useState } from "react";
import { useFirebaseAuth } from "./useFirebaseAuth";
import { useDeviceStore } from "../store/deviceStore";
import { subscribeDevice, subscribeDeviceById } from "../services/deviceService";
import { Device } from "../types/device";
import { isFirebaseConfigured } from "../firebase/config";

export function useFirebaseDevices(deviceIds?: string[]) {
  const { user } = useFirebaseAuth();
  const deviceMap = useDeviceStore((state) => state.devices);
  const setDevices = useDeviceStore((state) => state.setDevices);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Stabilize setDevices in a ref
  const setDevicesRef = useRef(setDevices);
  setDevicesRef.current = setDevices;

  // ✅ null = "ambil semua by owner", string = "ambil spesifik IDs"
  const deviceIdsKey = deviceIds === undefined ? null : deviceIds.join(",");

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setDevicesRef.current({});
      setLoading(false);
      setError("Firebase is not configured.");
      return;
    }

    if (!user?.uid) {
      setDevicesRef.current({});
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // ✅ Mode 1: tanpa deviceIds → subscribe semua /devices, filter by owner
    if (deviceIdsKey === null) {
      const unsubscribe = subscribeDevice(
        (allDevices) => {
          const ownedDevices = Object.fromEntries(
            Object.entries(allDevices).filter(([, device]) => {
              const owner =
                (device as Device & { ownerId?: string; owner?: string }).ownerId ||
                (device as Device & { ownerId?: string; owner?: string }).owner;
              // Tampilkan jika: belum ada owner, owner kosong, atau owner adalah user ini
              return !owner || owner === "" || owner === user.uid;
            })
          );
          setDevicesRef.current(ownedDevices);
          setLoading(false);
        },
        (subscriptionError) => {
          console.error("subscribeDevice error:", subscriptionError);
          setError(
            subscriptionError instanceof Error
              ? subscriptionError.message
              : "Unable to load devices."
          );
          setDevicesRef.current({});
          setLoading(false);
        }
      );

      return () => {
        if (typeof unsubscribe === "function") unsubscribe();
      };
    }

    // ✅ Mode 2: dengan deviceIds → subscribe per device spesifik
    const ids = deviceIdsKey ? deviceIdsKey.split(",") : [];

    if (ids.length === 0) {
      setDevicesRef.current({});
      setLoading(false);
      return;
    }

    const currentDeviceMap: Record<string, Device> = {};
    const seenInitialSnapshot = new Set<string>();

    const markInitialLoaded = (deviceId: string) => {
      if (!seenInitialSnapshot.has(deviceId)) {
        seenInitialSnapshot.add(deviceId);
        if (seenInitialSnapshot.size >= ids.length) {
          setLoading(false);
        }
      }
    };

    const unsubscribers = ids.map((deviceId) =>
      subscribeDeviceById(
        deviceId,
        (deviceData) => {
          if (deviceData) {
            currentDeviceMap[deviceId] = {
              ...deviceData,
              id: deviceData.id || deviceId,
            };
          } else {
            delete currentDeviceMap[deviceId];
          }
          setDevicesRef.current({ ...currentDeviceMap });
          markInitialLoaded(deviceId);
        },
        (subscriptionError) => {
          console.error(subscriptionError);
          setError(
            subscriptionError instanceof Error
              ? subscriptionError.message
              : `Unable to load device ${deviceId}.`
          );
          markInitialLoaded(deviceId);
        }
      )
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => {
        if (typeof unsubscribe === "function") unsubscribe();
      });
    };
  }, [user?.uid, deviceIdsKey, refreshKey]);

  const devices = useMemo(
    () =>
      Object.entries(deviceMap).map(([id, device]) => ({
        ...device,
        id: device.id || id,
      })),
    [deviceMap]
  );

  const refreshDevices = () => {
    setLoading(true);
    setError(null);
    setDevicesRef.current({});
    setRefreshKey((current) => current + 1);
  };

  return {
    devices,
    deviceMap,
    loading,
    error,
    firebaseReady: Boolean(isFirebaseConfigured),
    refreshDevices,
  };
}