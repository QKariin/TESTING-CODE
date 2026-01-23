import { getThumbnail } from "./media.js";

// Utility functions - FULL LOGIC RESTORED & PROTECTED
export function getOptimizedUrl(url, width) {
    if (!url) return "";
    if (url.startsWith('data:')) return url;

    if (url.includes("cloudinary")) return "https://upcdn.io/kW2K8hR/raw/uploads/2025/12/06/collar-512.png";

    // REMOVED THE CLOUDINARY KILL SWITCH THAT WAS BREAKING YOUR LOGS
    if (url.includes("upcdn.io")) {
        let cleanUrl = getThumbnail(url);
        const sep = cleanUrl.includes("?") ? "&" : "?";
        return `${cleanUrl}${sep}width=${width}&format=auto&quality=auto&dpr=auto`;
    }
    
    // Allow Wix/Cloudinary images to pass through
    return url;
}

export const SafeStorage = {
    setItem: (key, value) => { 
        try { localStorage.setItem(key, value); } catch(e) { console.warn("Storage blocked by browser settings."); } 
    },
    getItem: (key) => { 
        try { return localStorage.getItem(key); } catch(e) { return null; } 
    },
    removeItem: (key) => { 
        try { localStorage.removeItem(key); } catch(e) {} 
    }
};

export function triggerSound(id) {
    const el = document.getElementById(id);
    // FIXED: Added check to see if the element actually exists before playing
    if (el && typeof el.play === 'function') {
        el.pause(); 
        el.currentTime = 0;
        const playPromise = el.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                // This is normal if the user hasn't clicked anything yet
                console.log("Audio waiting for user interaction.");
            });
        }
    }
}

export function unlockAudio() {
    const audios = document.querySelectorAll("audio");
    audios.forEach(a => {
        a.play().then(() => {
            a.pause();
            a.currentTime = 0;
        }).catch(() => {});
    });

    // Remove listener after unlocking
    window.removeEventListener("click", unlockAudio);
    window.removeEventListener("touchstart", unlockAudio);
}

// RESTORED: Full HTML cleaning with line-break handling and symbol decoding
// js/utils.js (Slave Side)

export function cleanHTML(html) {
    if (!html) return "";
    
    try {
        let target = html;

        // 1. If it's a string but looks like JSON, unwrap it first
        if (typeof target === 'string' && (target.startsWith('{') || target.startsWith('['))) {
            try {
                const parsed = JSON.parse(target);
                target = Array.isArray(parsed) ? (parsed[0]?.text || parsed[0]) : (parsed.text || target);
            } catch (e) { }
        }

        // 2. THE NUCLEAR STRIPPER (Removes <p>, <span>, class="font", etc.)
        // This uses the browser's engine to extract ONLY the clean text
        const doc = new DOMParser().parseFromString(target, 'text/html');
        let result = doc.body.textContent || target || "";

        // 3. Final Polish: remove system brackets [LIKE_THIS] and extra spaces
        result = result.replace(/\[.*?\]/g, '').replace(/\s\s+/g, ' ');

        return result.trim();
    } catch (e) {
        // Fallback just in case
        return html.replace(/<[^>]*>?/gm, '').trim();
    }
}

// FIXED: Complete statistics migration with NULL-SAFETY checks
export function migrateGameStatsToStats(gameStats, stats) {
    // If stats are missing, provide a default object so it doesn't crash
    const s = stats || {};
    const gs = gameStats || {};
    
    return {
        ...s,
        approvedTasks: Math.max(s.approvedTasks || 0, gs.completedTasks || 0),
        dailyCompletedTasks: Math.max(s.dailyCompletedTasks || 0, gs.completedTasks || 0),
        dailyStreak: Math.max(s.dailyStreak || 0, gs.currentStreak || 0),
        dailyScore: Math.max(s.dailyScore || 0, gs.points || 0),
        monthlyTotalTasks: Math.max(s.monthlyTotalTasks || 0, gs.totalTasks || 0),
        monthlyScore: Math.max(s.monthlyScore || 0, gs.points || 0)
    };
}
