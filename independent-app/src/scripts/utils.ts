// src/scripts/utils.ts
// Utility functions - Converted to TypeScript

import { getThumbnail } from "./media";

export function getOptimizedUrl(url: string | null | undefined, width: number): string {
    if (!url) return "";
    if (url.startsWith('data:')) return url;

    if (url.includes("cloudinary")) return "https://upcdn.io/kW2K8hR/raw/uploads/2025/12/06/collar-512.png";

    if (url.includes("upcdn.io")) {
        const cleanUrl = getThumbnail(url);
        if (!cleanUrl) return url;
        const sep = cleanUrl.includes("?") ? "&" : "?";
        return `${cleanUrl}${sep}width=${width}&format=auto&quality=auto&dpr=auto`;
    }

    return url;
}

export const SafeStorage = {
    setItem: (key: string, value: string): void => {
        try { localStorage.setItem(key, value); } catch (e) { console.warn("Storage blocked by browser settings."); }
    },
    getItem: (key: string): string | null => {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    removeItem: (key: string): void => {
        try { localStorage.removeItem(key); } catch (e) { }
    }
};

export function triggerSound(id: string): void {
    const el = document.getElementById(id) as HTMLAudioElement | null;
    if (el && typeof el.play === 'function') {
        el.pause();
        el.currentTime = 0;
        const playPromise = el.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => {
                console.log("Audio waiting for user interaction.");
            });
        }
    }
}

export function unlockAudio(): void {
    const audios = document.querySelectorAll("audio");
    audios.forEach(a => {
        a.play().then(() => {
            a.pause();
            a.currentTime = 0;
        }).catch(() => { });
    });

    window.removeEventListener("click", unlockAudio);
    window.removeEventListener("touchstart", unlockAudio);
}

export function cleanHTML(html: string | null | undefined): string {
    if (!html) return "";

    try {
        let target = html;

        if (typeof target === 'string' && (target.startsWith('{') || target.startsWith('['))) {
            try {
                const parsed = JSON.parse(target);
                target = Array.isArray(parsed) ? (parsed[0]?.text || parsed[0]) : (parsed.text || target);
            } catch (e) { }
        }

        const doc = new DOMParser().parseFromString(target, 'text/html');
        let result = doc.body.textContent || target || "";

        result = result.replace(/\[.*?\]/g, '').replace(/\s\s+/g, ' ');

        return result.trim();
    } catch (e) {
        return html.replace(/<[^>]*>?/gm, '').trim();
    }
}

export function formatTimer(ms: number): string {
    if (ms <= 0) return "00:00";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function clean(str: any): string {
    if (str === null || str === undefined) return "";
    let target = str;

    if (typeof target === 'object' && !Array.isArray(target)) {
        target = target.text || target.task || target.title || target.value || JSON.stringify(target);
    }
    if (typeof target === 'string' && (target.startsWith('{') || target.startsWith('['))) {
        try {
            const parsed = JSON.parse(target);
            target = Array.isArray(parsed) ? (parsed[0]?.text || parsed[0]) : (parsed.text || target);
        } catch (e) { }
    }

    if (typeof target === 'string') {
        target = target.replace(/\n/g, ' __BR__ ');
        target = target.replace(/<br\s*\/?>/gi, ' __BR__ ');
        target = target.replace(/<[^>]*>?/gm, ' ');
        // Decoding entities if in browser
        if (typeof DOMParser !== 'undefined') {
            const doc = new DOMParser().parseFromString(target, 'text/html');
            target = doc.body.textContent || target;
        }
    }

    let result = (target || "").toString();
    result = result.replace(/\[.*?\]/g, '');
    result = result.replace(/\s\s+/g, ' ');

    result = result.replace(/__BR__/g, '\n').trim();
    return result;
}

export function raw(str: string): string {
    if (!str) return "";
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\n/g, '\\n');
}

export function forceBottom(id: string = 'adminChatBox'): void {
    const chatBox = document.getElementById(id);
    if (chatBox) {
        chatBox.scrollTop = chatBox.scrollHeight;
        const anchor = document.getElementById('chat-anchor');
        if (anchor) anchor.scrollIntoView({ behavior: 'instant' });
    }
}
