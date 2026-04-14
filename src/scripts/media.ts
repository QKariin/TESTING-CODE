// src/scripts/media.ts
// media.ts - Converted to TypeScript



export function fileType(file: File): "video" | "image" | "unknown" {
    if (!file) return "unknown";

    const name = file.name.toLowerCase();
    const type = file.type.toLowerCase();

    if (type.startsWith("video/")) return "video";
    if (type.startsWith("image/")) return "image";

    if (/\.(mp4|mov|webm)$/i.test(name)) return "video";
    if (/\.(jpg|jpeg|png|gif|webp|avif|bmp|svg)$/i.test(name)) return "image";

    return "unknown";
}

export function mediaType(url: string | null | undefined): "video" | "image" | "unknown" {
    if (!url) return "unknown";

    const originalUrl = url.toLowerCase();

    // 1. Explicit Wix Protocol Check
    if (originalUrl.startsWith('wix:image')) return "image";
    if (originalUrl.startsWith('wix:video')) return "video";

    // 3. Supabase Check
    if (originalUrl.includes('supabase.co/storage')) {
        const isVideo = /\.(mp4|webm|mov)(\?|$)/.test(originalUrl);
        const isImage = /\.(jpg|jpeg|png|gif|webp|avif|bmp|svg)(\?|$)/.test(originalUrl);
        if (isImage) return "image";
        if (isVideo) return "video";
    }

    // 4. Extension Check
    const isVideoExt = /\.(mp4|webm|mov)(\?|$)/.test(originalUrl);
    const isImageExt = /\.(jpg|jpeg|png|gif|webp|avif|bmp|svg)(\?|$)/.test(originalUrl);

    if (isImageExt) return "image";
    if (isVideoExt) return "video";

    return "unknown";
}

export function getThumbnail(url: string | null | undefined): string | null | undefined {
    if (!url) return url;
    if (url.includes('supabase.co/storage') && mediaType(url) === 'image') return url; // Already client-compressed
    return getOptimizedUrl(url, 200); // Fallback to optimized wix
}

export function getOptimizedUrl(url: string | null | undefined, width: number = 400): string {
    if (!url || typeof url !== "string") return "";
    if (url.startsWith("failed")) return ""; // bad upload result stored in DB
    if (url.startsWith("data:")) return url;
    if (url.startsWith("blob:")) return url;
    // Normalize http:// → https:// so Next.js image optimizer and browsers accept the URL
    url = url.replace(/^http:\/\//i, "https://");
    if (url === "FORCED" || url === "SKIPPED") return "/queen-karin.png";
    if (url.includes("token=")) return url; // Already a signed URL
    // Supabase storage URLs — return direct URL (avoids /_next/image 400s when files are missing)
    if (url.includes("supabase.co/storage")) {
        return url;
    }

    // 1. CLOUDINARY
    if (url.includes("cloudinary.com")) {
        return url;
    }

    // 2. WIX VECTORS
    if (url.startsWith("wix:vector://")) {
        const parts = url.split("/");
        const id = parts[3] ? parts[3].split("#")[0] : "";
        if (id) return `https://static.wixstatic.com/shapes/${id}`;
    }

    // 4. WIX IMAGES (ROBUST FIX)
    if (url.startsWith("wix:image://")) {
        try {
            const parts = url.split('/');
            const id = parts[3];
            if (id) {
                const cleanId = id.split('#')[0];
                return `https://static.wixstatic.com/media/${cleanId}/v1/fill/w_${width},h_${width},al_c,q_80/file.jpg`;
            }
        } catch (e) {
            console.error("Wix Image Parse Error", e);
        }
    }

    // 5. WIX VIDEOS
    if (url.startsWith("wix:video://")) {
        try {
            const parts = url.split('/');
            const id = parts[3];
            if (id) {
                const cleanId = id.split('#')[0];
                return `https://video.wixstatic.com/video/${cleanId}/mp4/file.mp4`;
            }
        } catch (e) {
            console.error("Wix Video Parse Error", e);
        }
    }

    if (url.startsWith("http")) return url;

    return "/queen-karin.png";
}

const PRIVATE_PREFIXES = ['task-proofs/', 'chat/', 'admin-chat/', 'chat-media/', 'challenge-proofs/'];

function isPrivateStorageUrl(url: string): boolean {
    if (!url.includes('supabase.co/storage')) return false;
    return PRIVATE_PREFIXES.some(prefix => url.includes('/' + prefix));
}

// Cache signed URLs in memory to avoid re-fetching on every render
const _signedUrlCache = new Map<string, { url: string; expires: number }>();

export async function getSignedUrl(url: string | null | undefined): Promise<string> {
    if (!url) return "";
    if (!isPrivateStorageUrl(url)) return url;
    if (url.includes('token=')) return url; // already signed

    const cached = _signedUrlCache.get(url);
    if (cached && cached.expires > Date.now()) return cached.url;

    try {
        const res = await fetch(`/api/media/url?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if (data.url) {
            // Cache for 6 days (signed URL valid for 7)
            _signedUrlCache.set(url, { url: data.url, expires: Date.now() + 6 * 24 * 60 * 60 * 1000 });
            return data.url;
        }
    } catch { }
    return url; // fallback to original
}
