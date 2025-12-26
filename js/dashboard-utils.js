// Dashboard Utility Functions
// Helper functions used across the dashboard

export function getOptimizedUrl(url, width = 400) {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    if (url.startsWith("wix:image://v1/")) {
        const id = url.split('/')[3].split('#')[0];
        return `https://static.wixstatic.com/media/${id}/v1/fill/w_${width},h_${width},al_c,q_80,usm_0.66_1.00_0.01,enc_auto/${id}`;
    }
    if (url.startsWith("wix:video://v1/")) {
        const id = url.split('/')[3].split('#')[0];
        return `https://video.wixstatic.com/video/${id}/mp4/file.mp4`;
    }
    return url;
}

export function clean(str) {
    if (str === null || str === undefined) return "";
    
    let target = str;

    // 1. If it's a string that looks like JSON, "unwrap" it first
    if (typeof target === 'string' && (target.startsWith('{') || target.startsWith('['))) {
        try { target = JSON.parse(target); } catch (e) { /* use as string */ }
    }

    // 2. If it's an array, take the first item
    if (Array.isArray(target)) {
        target = target[0];
    }

    // 3. THE DEEP HUNTER: If it's an object, find the FIRST string value inside it
    if (typeof target === 'object' && target !== null) {
        // Try common Wix keys first
        const commonKeys = ['text', 'task', 'value', 'label', 'title', 'description', 'content'];
        for (let key of commonKeys) {
            if (target[key] && typeof target[key] === 'string') {
                target = target[key];
                break;
            }
        }
        
        // If still an object, just grab the first property that is a string
        if (typeof target === 'object') {
            const firstString = Object.values(target).find(val => typeof val === 'string' && val.length > 2);
            target = firstString || JSON.stringify(target);
        }
    }

    // 4. FINAL CLEANUP: Remove system codes and brackets
    let finalString = target.toString();
    
    // Remove anything in brackets [LIKE_THIS]
    finalString = finalString.replace(/\[.*?\]/g, ''); 
    // Remove "CMD:", "TASK:", etc.
    finalString = finalString.replace(/^(.*?):/i, (match, p1) => {
        const tags = ['CMD', 'TASK', 'TEXT', 'MSG', 'JSON'];
        return tags.includes(p1.toUpperCase()) ? '' : match;
    });

    return finalString.replace(/[<>]/g, '').trim().substring(0, 100);
}

export function raw(str) {
    if (!str) return "";
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function formatTimer(ms) {
    if (ms <= 0) return "00:00";
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function triggerSound(id) {
    const sound = document.getElementById(id);
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(() => {});
    }
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
