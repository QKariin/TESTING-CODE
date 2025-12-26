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
    // If it's the raw debug string you saw in the console, it's already clean!
    return str.toString().replace(/[<>]/g, '').substring(0, 100);
}

export function getOptimizedUrl(url, width = 400) {
    if (!url || typeof url !== 'string') return "";
    if (url.startsWith("http")) return url;
    
    // Fix for the "Vector" icons you see in the error
    if (url.startsWith("wix:vector://v1/")) {
        const id = url.split('/')[3].split('#')[0];
        return `https://static.wixstatic.com/shapes/${id}`;
    }
    
    if (url.startsWith("wix:image://v1/")) {
        const id = url.split('/')[3].split('#')[0];
        return `https://static.wixstatic.com/media/${id}/v1/fill/w_${width},h_${width},al_c,q_80,usm_0.66_1.00_0.01,enc_auto/${id}`;
    }
    return url;
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
