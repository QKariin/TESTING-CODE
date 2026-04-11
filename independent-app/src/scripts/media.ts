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
    if (url.includes('supabase.co/storage') && mediaType(url) === 'image') return getOptimizedUrl(url, 200); // Route through CDN cache
    return getOptimizedUrl(url, 200); // Fallback to optimized wix
}

export function getOptimizedUrl(url: string | null | undefined, width: number = 400): string {
    if (!url || typeof url !== "string") return "";
    if (url.startsWith("failed")) return ""; // bad upload result stored in DB
    if (url.startsWith("data:")) return url;
    if (url.startsWith("blob:")) return url;
    if (url === "FORCED" || url === "SKIPPED") return "/queen-karin.png";
    if (url.includes("token=")) return url; // Already a signed URL
    // Supabase storage URLs — route through Next.js image CDN so Vercel caches them
    // Supabase only gets hit once per image, all subsequent loads served from Vercel edge
    if (url.includes("supabase.co/storage")) {
        const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url);
        if (isVideo) return url; // videos can't go through next/image, serve direct
        return `/_next/image?url=${encodeURIComponent(url)}&w=${width <= 200 ? 256 : width <= 400 ? 828 : 1200}&q=75`;
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

export async function getSignedUrl(url: string | null | undefined): Promise<string> {
    if (!url) return "";
    return url;
}
