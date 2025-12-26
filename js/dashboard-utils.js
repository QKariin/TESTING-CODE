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
    if (!str) return "";
    
    let text = str;

    // 1. If Wix sent an object, grab the text inside
    if (typeof str === 'object') {
        text = str.text || str.task || str.title || str.value || JSON.stringify(str);
    }

    // 2. If it's a string but looks like JSON, unwrap it
    if (typeof text === 'string' && text.includes('{')) {
        try {
            const parsed = JSON.parse(text);
            text = parsed.text || parsed.task || parsed.title || text;
        } catch (e) { 
            // If it's not valid JSON, we manually strip curly braces
            text = text.replace(/[{}"]/g, ''); 
        }
    }

    // 3. REMOVE THE "Formatting Shit"
    let finalString = text.toString();
    
    // Remove anything in brackets [CMD:123] or [TASK]
    finalString = finalString.replace(/\[.*?\]/g, ''); 
    
    // Remove prefixes like "text:", "task:", "value:" that Wix adds
    finalString = finalString.replace(/^(text|task|value|title|description):/i, '');
    
    // Remove leftover quotes and backslashes
    finalString = finalString.replace(/["\\]/g, '');

    // 4. Final safety clean
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
