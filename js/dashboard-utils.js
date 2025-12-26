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
    if (!str) return "";
    
    let text = str;

    // 1. DEBUG: If you open F12 console, you can see exactly what is breaking
    // console.log("Cleaning task:", str); 

    // 2. If it's an Object (Wix often sends these)
    if (typeof str === 'object' && str !== null) {
        text = str.text || str.title || str.task || str.value || JSON.stringify(str);
    }

    // 3. If it's a JSON String (Wix often stores arrays as strings)
    if (typeof text === 'string' && (text.startsWith('{') || text.startsWith('['))) {
        try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
                text = parsed[0]?.text || parsed[0]?.task || parsed[0] || text;
            } else {
                text = parsed.text || parsed.title || parsed.task || text;
            }
        } catch (e) { /* Not valid JSON, continue */ }
    }

    // 4. Strip out System Commands/Tags (e.g., [TASK], CMD:, etc.)
    if (typeof text === 'string') {
        // Removes anything like [PROTECTED] or [!]
        text = text.replace(/\[.*?\]/g, ''); 
        // Removes common prefixes
        text = text.replace(/^(TASK:|CMD:|TEXT:|MSG:)/i, '');
        
        // 5. Clean HTML/Tags and trim whitespace
        text = text.replace(/[<>]/g, '').trim();
    }

    // Return the cleaned text (Max 100 chars for the UI)
    return text.toString().substring(0, 100);
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
