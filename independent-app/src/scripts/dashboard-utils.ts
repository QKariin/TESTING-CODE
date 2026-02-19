// src/scripts/dashboard-utils.ts
// Dashboard Utilities - Converted to TypeScript

export function getOptimizedUrl(url: string | null | undefined, width: number = 400): string {
    if (!url || typeof url !== 'string') return "";

    // 1. KILL CLOUDINARY
    if (url.includes("cloudinary.com")) return "";

    // 2. PASS THROUGH standard web links
    if (url.startsWith("http")) return url;

    // 3. HANDLE WIX VECTORS
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

export function clean(str: any): string {
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

    // 2. PRESERVE NEWLINES
    if (typeof target === 'string') {
        target = target.replace(/\n/g, ' __BR__ ');
        target = target.replace(/<br\s*\/?>/gi, ' __BR__ ');
    }

    // 3. THE RICH TEXT KILLER
    if (typeof target === 'string') {
        target = target.replace(/<[^>]*>?/gm, ' ');
        if (typeof window !== 'undefined') {
            const doc = new DOMParser().parseFromString(target, 'text/html');
            target = doc.body.textContent || target;
        }
    }

    // 4. FINAL CLEANUP
    let result = target.toString();
    result = result.replace(/\[.*?\]/g, ''); // Remove [TASK_ID] etc.
    result = result.replace(/\s\s+/g, ' ');  // Remove double spaces

    // 5. RESTORE NEWLINES
    result = result.replace(/__BR__/g, '\n').trim();

    return result;
}

export function raw(str: string | null | undefined): string {
    if (!str) return "";
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\n/g, '\\n');
}

export function formatTimer(ms: number): string {
    if (ms <= 0) return "00:00";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function forceBottom() {
    if (typeof window === 'undefined') return;
    const chatBox = document.getElementById('adminChatBox');
    if (chatBox) {
        chatBox.scrollTop = chatBox.scrollHeight;
        const anchor = document.getElementById('chat-anchor');
        if (anchor) anchor.scrollIntoView({ behavior: 'instant' });
    }
}

export function isAtBottom(): boolean {
    if (typeof window === 'undefined') return true;
    const b = document.getElementById('adminChatBox');
    if (!b) return true;
    return Math.abs(b.scrollHeight - b.clientHeight - b.scrollTop) < 50;
}

export function toggleMobStats() {
    if (typeof window === 'undefined') return;
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

if (typeof window !== 'undefined') {
    (window as any).toggleMobStats = toggleMobStats;
}
