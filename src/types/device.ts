export interface DeviceInfoPayload {
    boot_at?: number;
    device_id?: string;
    device_type?: string;
    firmware?: string;
    free_heap?: number;
    ip?: string;
    last_seen?: number;
    mac?: string;
    mdns?: string;
    rssi?: number;
    ssid?: string;
    uptime_sec?: number;
    online?: boolean;
}

export interface DeviceConfigPayload {
    laser_on?: boolean;
    monitoring?: boolean;
    threshold?: number;
    schedule?: DeviceSchedulePayload;
    notifications?: {
        enabled?: boolean;
    };
    suppressAlertsUntil?: number;
    [key: string]: unknown;
}

export interface DeviceSensorPayload {
    laser?: string;
    ldr_raw?: number;
    updated_at?: number;
    distance?: number;
    motion?: boolean;
    pir?: boolean;
    timestamp?: number;
}

export interface DeviceSchedulePayload {
    enabled?: boolean;
    start?: string;
    stop?: string;
    days?: boolean[];
    info?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface Device {
    id: string;
    name: string;
    location: string;
    ownerId?: string;
    sharedWith?: string[];
    status: "online" | "offline";
    monitoring?: boolean;
    threshold?: number;
    firmware: string;
    freeheap: number;
    ip: string;
    mac: string;
    ssid: string;
    rssi: number;
    registeredAt: number;
    lastSeen: number;
    uptime: number;
    deviceType?: string;
    bootAt?: number;
    freeHeap?: number;
    mdns?: string;
    uptimeSec?: number;
    online?: boolean;
    laserOn?: boolean;
    laser_on?: boolean;
    schedule?: DeviceSchedulePayload;
    config?: DeviceConfigPayload;
    sensor?: DeviceSensorPayload;
    info?: DeviceInfoPayload;
}