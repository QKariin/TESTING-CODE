// dashboard-utils.js

export function getOptimizedUrl(url, width = 400) {
    if (!url || typeof url !== 'string') return "";
    
    // 1. KILL CLOUDINARY (Stops the 401 errors from your logs)
    if (url.includes("cloudinary.com")) return "";

    // 2. PASS THROUGH standard web links
    if (url.startsWith("http")) return url;
    
    // 3. HANDLE WIX VECTORS (Fixes the ERR_UNKNOWN_URL_SCHEME)
    if (url.startsWith("wix:vector://v1/")) {
        const id = url.split('/')[3].split('#')[0];
        return `https://static.wixstatic.com/shapes/${id}`;
    }
    
    // 4. HANDLE WIX IMAGES
    if (url.startsWith("wix:image://v1/")) {
        const id = url.split('/')[3].split('#')[0];
        return `https://static.wixstatic.com/media/${id}/v1/fill/w_${width},h_${width},al_c,q_80,usm_0.66_1.00_0.01,enc_auto/${id}`;
    }

    // 5. HANDLE WIX VIDEOS
    if (url.startsWith("wix:video://v1/")) {
        const id = url.split('/')[3].split('#')[0];
        return `https://video.wixstatic.com/video/${id}/mp4/file.mp4`;
    }

    return url;
}

export function clean(str) {
    if (str === null || str === undefined) return "";
    
    let target = str;

    // 1. Handle Objects or JSON Strings (Wix Collections)
    if (typeof target === 'object' && !Array.isArray(target)) {
        target = target.text || target.task || target.title || target.value || JSON.stringify(target);
    }
    if (typeof target === 'string' && (target.startsWith('{') || target.startsWith('['))) {
        try {
            const parsed = JSON.parse(target);
            target = Array.isArray(parsed) ? (parsed[0]?.text || parsed[0]) : (parsed.text || target);
        } catch (e) { }
    }

    // 2. THE RICH TEXT KILLER (Removes <p>, <span>, class="...", etc.)
    if (typeof target === 'string') {
        // This removes all HTML tags completely
        target = target.replace(/<[^>]*>?/gm, ' '); 
        
        // This decodes symbols like &amp; into & or &quot; into "
        const doc = new DOMParser().parseFromString(target, 'text/html');
        target = doc.body.textContent || target;
    }

    // 3. FINAL CLEANUP (Brackets and extra spaces)
    let result = target.toString();
    result = result.replace(/\[.*?\]/g, ''); // Remove [TASK_ID] etc.
    result = result.replace(/\s\s+/g, ' ');  // Remove double spaces

    return result.trim().substring(0, 100);
}

export function raw(str) {
    if (!str) return "";
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function formatTimer(ms) {
    if (ms <= 0) return "00:00";
    
    // Calculate Hours and Minutes
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    
    // Return format HH:MM (e.g., 23:59)
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function forceBottom() {
    const chatBox = document.getElementById('adminChatBox');
    if (chatBox) {
        chatBox.scrollTop = chatBox.scrollHeight;
        const anchor = document.getElementById('chat-anchor');
        if (anchor) anchor.scrollIntoView({ behavior: 'instant' });
    }
}

export function isAtBottom() {
    const b = document.getElementById('adminChatBox');
    if (!b) return true;
    return Math.abs(b.scrollHeight - b.clientHeight - b.scrollTop) < 50;
}

export function toggleMobStats() {
    const deck = document.getElementById('statsDeck');
    const btn = document.getElementById('mobStatsToggle');
    if (deck && btn) {
        if (deck.classList.contains('show')) {
            deck.classList.remove('show');
            btn.innerText = 'VIEW STATS';
        } else {
            deck.classList.add('show');
            btn.innerText = 'HIDE STATS';
        }
    }
}
