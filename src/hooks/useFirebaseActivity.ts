import { useEffect, useMemo, useState } from "react";
import { subscribeAlertsForDevices } from "../services/alertService";
import { getStoredUserActivities, subscribeUserActivities, StoredActivityEntry } from "../services/activityHistoryService";
import { subscribeSensorData } from "../services/sensorService";
import { Alert } from "../types/alert";
import { Device } from "../types/device";
import { SensorData } from "../types/sensor";

export type ActivityItem = {
  id: string;
  type: "alert" | "warning" | "success" | "info" | "offline" | "sensor" | "user";
  title: string;
  device: string;
  time: string;
  timestamp: number;
  severity: "critical" | "warning" | "success" | "info";
};

const formatTimeAgo = (timestamp: number) => {
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

const activityFromAlert = (alert: Alert, device?: Device): ActivityItem => ({
  id: `${alert.deviceId}-${alert.timestamp}`,
  type: alert.status === "resolved" ? "success" : alert.status === "read" ? "info" : "alert",
  title:
    alert.type === "intruder_detected"
      ? "Intrusion Detected"
      : "Device Alert",
  device: alert.deviceName || device?.name || alert.deviceId,
  time: formatTimeAgo(alert.timestamp),
  timestamp: alert.timestamp,
  severity:
    alert.status === "resolved" ? "success" : alert.status === "read" ? "info" : "critical",
});

const activityFromDevice = (device: Device): ActivityItem => ({
  id: `${device.id}-status-${device.lastSeen}`,
  type: device.status === "offline" ? "offline" : device.monitoring ? "success" : "info",
  title:
    device.status === "offline"
      ? "Device Offline"
      : device.laserOn
      ? "Laser Monitoring Enabled"
      : device.monitoring
      ? "Monitoring Enabled"
      : "Monitoring Disabled",
  device: device.name,
  time: formatTimeAgo(device.lastSeen),
  timestamp: device.lastSeen,
  severity: device.status === "offline" ? "warning" : device.monitoring ? "success" : "info",
});

const activityFromSensor = (device: Device, sensor: SensorData): ActivityItem | null => {
  const timestamp = sensor.updated_at ?? sensor.timestamp;

  if (!timestamp) {
    return null;
  }

  const hasLaser = typeof sensor.laser === "string";
  const hasLdr = typeof sensor.ldr_raw === "number";

  if (!hasLaser && !hasLdr) {
    return null;
  }

  const blocked = sensor.laser === "BLOCKED";
  const title = blocked
    ? "Laser Beam Blocked"
    : hasLaser
    ? "Laser Sensor Updated"
    : "Light Sensor Updated";

  const messageSuffix = hasLdr ? ` • LDR ${sensor.ldr_raw}` : "";

  return {
    id: `${device.id}-sensor-${timestamp}`,
    type: "sensor",
    title: `${title}${messageSuffix}`,
    device: device.name,
    time: formatTimeAgo(timestamp),
    timestamp,
    severity: blocked ? "warning" : "info",
  };
};

export function useFirebaseActivity(devices: Device[]) {
  const [alertsById, setAlertsById] = useState<Record<string, Alert>>({});
  const [sensorByDevice, setSensorByDevice] = useState<Record<string, SensorData | null>>({});
  const [userActivities, setUserActivities] = useState<StoredActivityEntry[]>(() => getStoredUserActivities());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      if (typeof unsubscribeAlerts === "function") {
        unsubscribeAlerts();
      }

      unsubscribers.forEach((unsubscribe) => {
        if (typeof unsubscribe === "function") {
          unsubscribe();
        }
      });
    };
  }, [devices]);

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
        if (!sensor) {
          return [];
        }

        const device = devices[index];
        const activity = activityFromSensor(device, sensor);

        return activity ? [activity] : [];
      });

    const localUserActivities = userActivities.map<ActivityItem>((activity) => ({
      id: activity.id,
      type: activity.type,
      title: activity.title,
      device: activity.device,
      time: formatTimeAgo(activity.timestamp),
      timestamp: activity.timestamp,
      severity: activity.severity,
    }));

    return [...alertActivities, ...sensorActivities, ...deviceActivities, ...localUserActivities].sort((left, right) => right.timestamp - left.timestamp);
  }, [alertsById, devices, sensorByDevice, userActivities]);

  return { activities, loading, error };
}