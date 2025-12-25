// Utility functions - FULL LOGIC RESTORED & PROTECTED
export function getOptimizedUrl(url, width) {
    if (!url) return "";
    // If it's already a full URL or base64, don't mess with it
    if (url.startsWith('data:')) return url;

    if (url.includes("cloudinary.com") && url.includes("/upload/")) {
        let cleanUrl = url.replace(/\.(mp4|webm|mov)$/i, ".jpg");
        return cleanUrl.replace("/upload/", `/upload/f_auto,q_auto,dpr_auto,c_limit,w_${width}/`);
    }
    if (url.includes("upcdn.io")) {
        let cleanUrl = url.replace(/\.(mp4|webm|mov)$/i, ".jpg");
        const sep = cleanUrl.includes("?") ? "&" : "?";
        return `${cleanUrl}${sep}width=${width}&format=auto&quality=auto&dpr=auto`;
    }
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

// RESTORED: Full HTML cleaning with line-break handling and symbol decoding
export function cleanHTML(html) {
    if(!html) return "";
    try {
        let text = html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n");
        text = text.replace(/<[^>]+>/g, "");
        const txt = document.createElement("textarea");
        txt.innerHTML = text;
        return txt.value.trim();
    } catch (e) {
        return html; // Fallback if DOM is not ready
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
