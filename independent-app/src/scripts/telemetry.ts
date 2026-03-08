export async function trackUserAnalytics(userId: string) {
    if (!userId) return;

    try {
        // 1. Gather Passive Browser Metrics
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const screenResolution = `${window.innerWidth}x${window.innerHeight}`;
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
        const os = navigator.platform;
        const userAgentString = navigator.userAgent;

        // Basic user agent parsing
        let deviceType = "Desktop";
        if (/Mobi|Android|iPhone/i.test(userAgentString)) {
            deviceType = "Mobile";
        } else if (/Tablet|iPad/i.test(userAgentString)) {
            deviceType = "Tablet";
        }

        let browserName = "Unknown";
        if (userAgentString.includes("Firefox")) browserName = "Firefox";
        else if (userAgentString.includes("SamsungBrowser")) browserName = "Samsung Internet";
        else if (userAgentString.includes("Opera") || userAgentString.includes("OPR")) browserName = "Opera";
        else if (userAgentString.includes("Trident")) browserName = "Internet Explorer";
        else if (userAgentString.includes("Edge")) browserName = "Edge";
        else if (userAgentString.includes("Chrome")) browserName = "Chrome";
        else if (userAgentString.includes("Safari")) browserName = "Safari";

        // 2. Attempt to gather Battery info (Supported on WebKit/Blink browsers)
        let batteryData: any = { level: 'unknown', charging: 'unknown' };
        if ('getBattery' in navigator) {
            try {
                const battery: any = await (navigator as any).getBattery();
                batteryData = {
                    level: Math.round(battery.level * 100),
                    charging: battery.charging
                };
            } catch (e) {
                console.warn("Battery API error:", e);
            }
        }

        // 3. Construct Data Payload
        const clientData = {
            device: {
                type: deviceType,
                os: os,
                browser: browserName,
                resolution: screenResolution,
                is_pwa: isStandalone,
                battery: batteryData
            },
            timezone: timezone,
        };

        // 4. Send to Vercel API for IP detection and Supabase saving
        await fetch('/api/tracking/ping', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId,
                clientData
            }),
            // Don't wait or care about response, fail silently
        }).catch(() => { });

    } catch (e) {
        // Passive tracking should never interrupt the user experience
        console.warn('Navigation telemetry failed silently:', e);
    }
}
