import { get, ref, onValue, set, update, remove } from "firebase/database";
import { database } from "../firebase/config";
import { Device } from "../types/device";

type DeviceRecord = Device & {
    info?: Device["info"];
    sensor?: Device["sensor"];
    schedule?: Device["schedule"];
    config?: Device["config"];
    laser_on?: boolean;
    monitoring?: boolean;
    threshold?: number;
    owner?: string | null;
};

const normalizeDevice = (id: string, record: DeviceRecord): Device => {
    const info = record.info ?? {};
    const sensor = record.sensor ?? {};
    const config = record.config ?? {};
    const deviceType = info.device_type ?? record.deviceType ?? record.name ?? "Unknown Device";
    const bootAt = info.boot_at ?? record.bootAt ?? record.registeredAt ?? Date.now();
    const freeHeap = record.freeHeap ?? info.free_heap ?? record.freeheap ?? 0;
    const lastSeen = record.lastSeen ?? info.last_seen ?? Date.now();
    const uptime = record.uptime ?? info.uptime_sec ?? record.uptimeSec ?? 0;
    const online = record.online ?? info.online ?? record.status === "online";
    const firmware = record.firmware ?? info.firmware ?? "Unknown";
    const ip = record.ip ?? info.ip ?? "Unknown";
    const mac = record.mac ?? info.mac ?? "Unknown";
    const ssid = record.ssid ?? info.ssid ?? record.location ?? "Unknown";
    const rssi = record.rssi ?? info.rssi ?? 0;
    const mdns = record.mdns ?? info.mdns ?? "Unknown";
    const laserOn = record.laserOn ?? record.laser_on ?? config.laser_on ?? config.monitoring ?? false;
    const schedule = record.schedule ?? config.schedule ?? undefined;
    const monitoring = record.monitoring ?? config.monitoring ?? online;
    const threshold = record.threshold ?? config.threshold;

    // Normalize owner: support both 'owner' (from firmware) and 'ownerId' (from app)
    const ownerId = record.ownerId ?? record.owner ?? undefined;

    return {
        ...record,
        id: record.id || info.device_id || id,
        name: record.name ?? deviceType,
        location: record.location ?? ssid ?? mdns,
        status: online ? "online" : "offline",
        firmware,
        freeheap: freeHeap,
        freeHeap,
        ip,
        mac,
        ssid,
        rssi,
        registeredAt: bootAt,
        bootAt,
        lastSeen,
        uptime,
        uptimeSec: record.uptimeSec ?? info.uptime_sec ?? uptime,
        deviceType,
        mdns,
        online,
        monitoring,
        threshold,
        laserOn,
        schedule: schedule as Device["schedule"],
        config: config as Device["config"],
        info,
        sensor,
        ownerId,
    };
};

const normalizeDeviceMap = (deviceData: Record<string, DeviceRecord>) =>
    Object.entries(deviceData).reduce<Record<string, Device>>((accumulator, [id, record]) => {
        accumulator[id] = normalizeDevice(id, record);
        return accumulator;
    }, {});

const sanitizeDeviceKey = (value: string) => value.replace(/[.#$\[\]\/]/g, "_").trim();

export const subscribeDeviceById = (
    deviceId: string,
    callback: (deviceData: Device | null) => void,
    onError?: (error: unknown) => void
) => {
    if (!database) {
        callback(null);
        return () => undefined;
    }

    const deviceKey = sanitizeDeviceKey(deviceId);

    if (!deviceKey) {
        callback(null);
        return () => undefined;
    }

    const deviceRef = ref(database, `devices/${deviceKey}`);

    return onValue(
        deviceRef,
        (snapshot) => {
            const rawValue = snapshot.val();
            callback(rawValue ? normalizeDevice(deviceKey, rawValue) : null);
        },
        (error) => {
            onError?.(error);
            callback(null);
        }
    );
};

export const getDeviceById = async (deviceId: string): Promise<Device | null> => {
    if (!database) {
        return null;
    }

    const deviceKey = sanitizeDeviceKey(deviceId);

    if (!deviceKey) {
        return null;
    }

    try {
        const snapshot = await get(ref(database, `devices/${deviceKey}`));
        const rawValue = snapshot.val();
        return rawValue ? normalizeDevice(deviceKey, rawValue as DeviceRecord) : null;
    } catch (error) {
        console.warn(`getDeviceById(${deviceKey}) failed, treating as unclaimed:`, error);
        return null;
    }
};

export const subscribeDevice = (
    callback: (deviceData: Record<string, Device>) => void,
    onError?: (error: unknown) => void
) => {
    if (!database) {
        callback({});
        return () => undefined;
    }

    const deviceRef = ref(database, "devices");

    return onValue(
        deviceRef,
        (snapshot) => {
            callback(normalizeDeviceMap(snapshot.val() || {}));
        },
        (error) => {
            onError?.(error);
            callback({});
        }
    );
};

export type DeviceCreateInput = {
    deviceId: string;
    name: string;
    location: string;
    monitoring: boolean;
    ownerId?: string | null;
};

export const upsertDevice = async ({
    deviceId,
    name,
    location,
    monitoring,
    ownerId,
}: DeviceCreateInput) => {
    if (!database) {
        throw new Error("Firebase Realtime Database is not configured.");
    }

    const trimmedDeviceId = deviceId.trim();
    const trimmedName = name.trim();
    const trimmedLocation = location.trim();
    const key = sanitizeDeviceKey(trimmedDeviceId);

    if (!key) {
        throw new Error("Device ID is required.");
    }

    const now = Date.now();

    const deviceRef = ref(database, `devices/${key}`);
    const existingSnapshot = await get(deviceRef);
    const existingData = (existingSnapshot.val() || {}) as Partial<DeviceRecord>;

    const existingOwner = existingData.ownerId || existingData.owner || null;
    const ownerIsEmpty = !existingOwner || existingOwner === "";

    if (!ownerIsEmpty && ownerId && existingOwner !== ownerId) {
        throw new Error("Device ID is already registered by another account.");
    }

    const existingInfo = existingData.info ?? {};
    const existingSensor = existingData.sensor ?? {};
    const existingConfig = existingData.config ?? {};

    await update(deviceRef, {
        id: existingData.id ?? trimmedDeviceId,
        name: existingData.name ?? trimmedName,
        location: existingData.location ?? trimmedLocation,
        monitoring: existingData.monitoring ?? monitoring,
        config: {
            ...existingConfig,
            laser_on: existingConfig.laser_on ?? monitoring,
            monitoring: existingConfig.monitoring ?? monitoring,
            threshold: existingConfig.threshold ?? 50,
        },
        status: existingData.status ?? (monitoring ? "online" : "offline"),
        owner: ownerId ?? existingOwner ?? null,
        ownerId: ownerId ?? existingOwner ?? null,
        registeredAt: existingData.registeredAt ?? now,
        bootAt: existingData.bootAt ?? existingInfo.boot_at ?? now,
        lastSeen: now,
        uptime: existingData.uptime ?? 0,
        uptimeSec: existingData.uptimeSec ?? existingInfo.uptime_sec ?? 0,
        freeheap: existingData.freeheap ?? existingInfo.free_heap ?? 0,
        freeHeap: existingData.freeHeap ?? existingInfo.free_heap ?? 0,
        firmware: existingData.firmware ?? existingInfo.firmware ?? "Pending",
        ip: existingData.ip ?? existingInfo.ip ?? "Pending",
        mac: existingData.mac ?? existingInfo.mac ?? "Pending",
        ssid: existingData.ssid ?? existingInfo.ssid ?? trimmedLocation,
        rssi: existingData.rssi ?? existingInfo.rssi ?? 0,
        deviceType: existingData.deviceType ?? existingInfo.device_type ?? trimmedName,
        online: existingData.online ?? monitoring,
        info: Object.keys(existingInfo).length > 0
            ? existingInfo
            : {
                device_id: trimmedDeviceId,
                device_type: trimmedName,
                last_seen: now,
                boot_at: now,
                uptime_sec: 0,
                free_heap: 0,
                firmware: "Pending",
                ip: "Pending",
                mac: "Pending",
                ssid: trimmedLocation,
                rssi: 0,
                online: monitoring,
            },
        sensor: {
            ...existingSensor,
            updated_at: now,
        },
        laser_on: existingData.laserOn ?? existingConfig.laser_on ?? monitoring,
    });

    return { id: key, deviceId: trimmedDeviceId };
};

export const removeDevice = async (deviceId: string): Promise<void> => {
    if (!database) {
        throw new Error("Firebase Realtime Database is not configured.");
    }

    const key = sanitizeDeviceKey(deviceId);

    if (!key) {
        throw new Error("Device ID is required.");
    }

    await remove(ref(database, `devices/${key}`));
};

// ✅ Toggle power untuk satu device spesifik (dipakai DeviceDetailPage)
export const setDevicePowered = async (deviceId: string, enabled: boolean): Promise<void> => {
    if (!database) {
        throw new Error("Firebase Realtime Database is not configured.");
    }

    const key = sanitizeDeviceKey(deviceId);

    if (!key) {
        throw new Error("Device ID is required.");
    }

    const now = Date.now();

    await update(ref(database), {
        [`devices/${key}/monitoring`]: enabled,
        [`devices/${key}/laser_on`]: enabled,
        [`devices/${key}/config/monitoring`]: enabled,
        [`devices/${key}/config/laser_on`]: enabled,
        [`devices/${key}/online`]: enabled,
        [`devices/${key}/status`]: enabled ? "online" : "offline",
        [`devices/${key}/lastSeen`]: now,
        [`devices/${key}/info/last_seen`]: now,
    });
};

export const setAllDevicesPowered = async (enabled: boolean, devices: Device[]) => {
    if (!database) {
        throw new Error("Firebase Realtime Database is not configured.");
    }

    if (devices.length === 0) {
        return;
    }

    const now = Date.now();
    const payload = devices.reduce<Record<string, unknown>>((accumulator, device) => {
        const deviceKey = sanitizeDeviceKey(device.id || device.deviceType || device.name);

        accumulator[`devices/${deviceKey}/monitoring`] = enabled;
        accumulator[`devices/${deviceKey}/laser_on`] = enabled;
        accumulator[`devices/${deviceKey}/config/monitoring`] = enabled;
        accumulator[`devices/${deviceKey}/config/laser_on`] = enabled;
        accumulator[`devices/${deviceKey}/online`] = enabled;
        accumulator[`devices/${deviceKey}/status`] = enabled ? "online" : "offline";
        accumulator[`devices/${deviceKey}/lastSeen`] = now;
        accumulator[`devices/${deviceKey}/info/last_seen`] = now;
        accumulator[`devices/${deviceKey}/sensor/updated_at`] = now;

        return accumulator;
    }, {});

    await update(ref(database), payload);
};