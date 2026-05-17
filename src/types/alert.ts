export interface Alert {
    deviceId: string;
    deviceName: string;
    distance: number;
    location: string;
    pirTriggered: boolean;
    ultraSonicTriggered: boolean;
    status: "new" | "read" | "resolved";
    timestamp: number;
    type: "intruder_detected";
}