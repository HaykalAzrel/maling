import { useEffect, useMemo, useState } from "react";
import { subscribeAlertsForDevices } from "../services/alertService";
import { getStoredUserActivities, subscribeUserActivities, StoredActivityEntry } from "../services/activityHistoryService";
import { subscribeSensorData } from "../services/sensorService";
import { Alert } from "../types/alert";
import { Device } from "../types/device";
import { SensorData } from "../types/sensor";
import { getClearedAt } from "../services/activityHistoryService";
import { useFirebaseAuth } from "./useFirebaseAuth";
import { onValue, ref } from "firebase/database";
import { database } from "../firebase/config";

export type ActivityItem = {
  id: string;
  type: "alert" | "warning" | "success" | "info" | "offline" | "sensor" | "user";
  source: "alert" | "device" | "sensor" | "user";
  title: string;
  device: string;
  deviceId?: string;
  time: string;
  timestamp: number;
  severity: "critical" | "warning" | "success" | "info";
};

export const formatTimeAgo = (timestamp: number) => {
  const elapsed = Date.now() - timestamp;

  if (elapsed < 60_000) {
    return "Just now";
  }

  const minutes = Math.floor(elapsed / 60_000);

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(hours / 24);

  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const normalizeTimestamp = (ts: number) =>
  ts < 1_000_000_000_000 ? ts * 1000 : ts;

const activityFromAlert = (alert: Alert, device?: Device): ActivityItem => {
  console.log("alert raw timestamp:", alert.timestamp, "→", new Date(alert.timestamp).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }));
    // ← Cek laser_on saat alert dibuat
    const laserOn = device?.laserOn ?? device?.laser_on ?? true;
    
    // Kalau laser sedang mati, downgrade severity supaya tidak trigger alarm
    const isLaserOff = !laserOn;

    return {
        id: `${alert.deviceId}-${alert.timestamp}`,
        type: alert.status === "resolved" ? "success" : 
              alert.status === "read" ? "info" : 
              isLaserOff ? "info" : "alert",  // ← downgrade kalau laser off
        source: "alert",
        title: alert.type === "intruder_detected"
            ? "Intrusion Detected"
            : "Device Alert",
        device: alert.deviceName || device?.name || alert.deviceId,
        deviceId: alert.deviceId,
        time: formatTimeAgo(normalizeTimestamp(alert.timestamp)),
        timestamp: normalizeTimestamp(alert.timestamp),
        severity: alert.status === "resolved" ? "success" : 
                  alert.status === "read" ? "info" : 
                  isLaserOff ? "info" : "critical",  // ← tidak critical kalau laser off
    };
};

const activityFromDevice = (device: Device): ActivityItem => ({
  id: `${device.id}-status-${device.lastSeen}`,
  type: device.status === "offline" ? "offline" : device.monitoring ? "success" : "info",
  source: "device",
  title:
    device.status === "offline"
      ? "Device Offline"
      : device.laserOn
      ? "Laser Monitoring Enabled"
      : device.monitoring
      ? "Monitoring Enabled"
      : "Monitoring Disabled",
  device: device.name,
  deviceId: device.id,
  time: formatTimeAgo(normalizeTimestamp(device.lastSeen)), // ← tambah ini
  timestamp: normalizeTimestamp(device.lastSeen),
  severity: device.status === "offline" ? "warning" : device.monitoring ? "success" : "info",
});

const activityFromSensor = (device: Device, sensor: SensorData): ActivityItem | null => {
  const timestamp = sensor.updated_at ?? sensor.timestamp;

  if (!timestamp) {
    return null;
  }
  console.log("raw sensor timestamp:", timestamp, new Date(timestamp).toLocaleString());

  const normalizedTimestamp = normalizeTimestamp(timestamp);

  console.log("normalized timestamp:", normalizedTimestamp, new Date(normalizedTimestamp).toLocaleString());

  const hasLaser = typeof sensor.laser === "string";
  const hasLdr = typeof sensor.ldr_raw === "number";

  if (!hasLaser && !hasLdr) {
    return null;
  }

  const blocked = sensor.laser === "BLOCKED";
  if (blocked && !device.laserOn) return null;
  
  const title = blocked
    ? "Laser Beam Blocked"
    : hasLaser
    ? "Laser Sensor Updated"
    : "Light Sensor Updated";

  const messageSuffix = hasLdr ? ` • LDR ${sensor.ldr_raw}` : "";

  return {
    id: `${device.id}-sensor-${timestamp}`,
    type: "sensor",
    source: "sensor",
    title: `${title}${messageSuffix}`,
    device: device.name,
    deviceId: device.id,
    time: formatTimeAgo(normalizedTimestamp), // ← tambah ini
    timestamp: normalizedTimestamp,
    severity: blocked ? "warning" : "info",
  };
};

export function useFirebaseActivity(devices: Device[]) {
  const [alertsById, setAlertsById] = useState<Record<string, Alert>>({});
  const [sensorByDevice, setSensorByDevice] = useState<Record<string, SensorData | null>>({});
  const [userActivities, setUserActivities] = useState<StoredActivityEntry[]>(() => getStoredUserActivities());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useFirebaseAuth();
  const [clearedAt, setClearedAt] = useState<number>(0);

  // ← useEffect 1: fetch clearedAt
  useEffect(() => {
  if (devices.length === 0) return;
  const deviceIds = devices.map((d) => d.id);
  console.log("devices for clearedAt:", deviceIds);
  getClearedAt(deviceIds).then((timestamp) => {
    console.log("clearedAt result:", timestamp, new Date(timestamp).toLocaleString());
    setClearedAt(timestamp);
  });
}, [devices]);

  // ← useEffect 2: subscribe alerts dan sensor
  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribeAlerts = subscribeAlertsForDevices(
      devices.map((device) => device.id),
      (alerts) => {
        setAlertsById(alerts);
        setLoading(false);
      },
      (subscriptionError) => {
        setAlertsById({});
        setError(subscriptionError instanceof Error ? subscriptionError.message : "Unable to load Firebase activity.");
        setLoading(false);
      }
    );

    const unsubscribers = devices.map((device) =>
      subscribeSensorData(
        device.id,
        (sensor) => {
          setSensorByDevice((current) => ({
            ...current,
            [device.id]: sensor,
          }));
        },
        (subscriptionError) => {
          setError(subscriptionError instanceof Error ? subscriptionError.message : "Unable to load Firebase sensors.");
        }
      )
    );

    setLoading(false);

    return () => {
      if (typeof unsubscribeAlerts === "function") unsubscribeAlerts();
      unsubscribers.forEach((unsubscribe) => {
        if (typeof unsubscribe === "function") unsubscribe();
      });
    };
  }, [devices]);

  // ← useEffect 3: subscribe clearedAt realtime (taruh di sini)
useEffect(() => {
  if (!database || devices.length === 0) return;
  const db = database!;

  const unsubscribers = devices.map((device) =>
    onValue(ref(db, `devices/${device.id}/clearedAt`), (snapshot) => {
      const timestamp = (snapshot.val() as number | null) ?? 0;
      setClearedAt((current) => Math.max(current, timestamp));
    })
  );

  return () => {
    unsubscribers.forEach((unsubscribe) => {
      if (typeof unsubscribe === "function") unsubscribe();
    });
  };
}, [devices]);

  // ← useEffect 4: subscribe local activities
  useEffect(() => {
    const unsubscribe = subscribeUserActivities(setUserActivities);
    return unsubscribe;
  }, []);

  const activities = useMemo(() => {
    const deviceById = devices.reduce<Record<string, Device>>((accumulator, device) => {
      accumulator[device.id] = device;
      return accumulator;
    }, {});

    const alertActivities = Object.values(alertsById).map((alert) =>
      activityFromAlert(alert, deviceById[alert.deviceId])
    );

    const deviceActivities = devices.map(activityFromDevice);

    const sensorActivities = devices
      .map((device) => sensorByDevice[device.id] ?? device.sensor ?? null)
      .flatMap((sensor, index) => {
        if (!sensor) return [];
        const device = devices[index];
        const activity = activityFromSensor(device, sensor);
        return activity ? [activity] : [];
      });

    const localUserActivities = userActivities.map<ActivityItem>((activity) => ({
      id: activity.id,
      type: activity.type,
      source: "user",
      title: activity.title,
      device: activity.device,
      time: formatTimeAgo(activity.timestamp),
      timestamp: activity.timestamp,
      severity: activity.severity,
    }));

    // ← filter berdasarkan clearedAt
    return [...alertActivities, ...sensorActivities, ...deviceActivities, ...localUserActivities]
      .filter((activity) => activity.timestamp > clearedAt)
      .sort((left, right) => right.timestamp - left.timestamp);
  }, [alertsById, devices, sensorByDevice, userActivities, clearedAt]);

  return { activities, loading, error, alertsById, refreshClearedAt: () => {
  if (devices.length === 0) return;
  const deviceIds = devices.map((d) => d.id);
  getClearedAt(deviceIds).then(setClearedAt);
}};
}
