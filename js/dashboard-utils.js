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

    // 1. If it's a JSON object (common in Wix), extract the text
    if (typeof str === 'object') {
        text = str.text || str.title || str.task || JSON.stringify(str);
    }

    // 2. If it's a string that looks like JSON, try to parse it
    if (typeof text === 'string' && text.startsWith('{')) {
        try {
            const parsed = JSON.parse(text);
            text = parsed.text || parsed.title || parsed.task || text;
        } catch (e) { /* Not JSON, carry on */ }
    }

    // 3. Remove System Tags like [CMD:...] or [TASK]
    if (typeof text === 'string') {
        text = text.replace(/\[.*?\]/g, ''); // Removes anything inside brackets []
        text = text.replace(/^(CMD:|TASK:|TEXT:)/i, ''); // Removes prefixes like CMD: or TASK:
        
        // 4. Final sanitization
        text = text.replace(/[<>]/g, '').trim();
    }

    return text.substring(0, 100);
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
