addEventListener("scheduleCheck", async (resolve, reject, args) => {
    try {
        const { devices, firebaseUrl } = args;

        for (const device of devices) {
            const schedule = device.schedule ?? device.config?.schedule;
            if (!schedule?.enabled) continue;

            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const currentDay = now.getDay();
            const previousDay = (currentDay + 6) % 7;

            const parseTime = (t) => {
                const [h, m] = t.split(":").map(Number);
                return h * 60 + m;
            };

            const startMinutes = parseTime(schedule.start ?? "00:00");
            const stopMinutes  = parseTime(schedule.stop  ?? "00:00");
            const days         = schedule.days ?? [true,true,true,true,true,false,false];
            const sameDayWindow = startMinutes <= stopMinutes;

            const isActive = sameDayWindow
                ? days[currentDay] && currentMinutes >= startMinutes && currentMinutes < stopMinutes
                : (days[currentDay] && currentMinutes >= startMinutes) ||
                  (days[previousDay] && currentMinutes < stopMinutes);

            const currentlyOn = device.monitoring !== false && device.laser_on !== false;
            if (currentlyOn === isActive) continue;

            // Update Firebase via REST API (tidak bisa pakai SDK di background)
            const path = `devices/${device.id}`;
            const url  = `${firebaseUrl}/${path}.json`;

            await fetch(url, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    monitoring:          isActive,
                    laser_on:            isActive,
                    online:              isActive,
                    status:              isActive ? "online" : "offline",
                    "config/monitoring": isActive,
                    "config/laser_on":   isActive,
                }),
            });
        }

        resolve();
    } catch (e) {
        reject(e.message);
    }
});