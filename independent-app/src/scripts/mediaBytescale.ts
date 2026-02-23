// src/scripts/mediaBytescale.ts
// Bytescale media handling - Converted to TypeScript

import { BYTESCALE_CONFIG } from "../lib/config";

/* -----------------------------
 * Upload
 * --------------------------- */

function generateFilename(originalFile: File): string {
    const ext = originalFile.name.split(".").pop();
    let uuid;
    try {
        if (typeof crypto?.randomUUID === 'function') {
            uuid = crypto.randomUUID();
        } else {
            uuid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        }
    } catch (e) {
        uuid = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    }
    return `${uuid}.${ext}`;
}

export async function uploadToBytescale(subject: string, file: File, customFolder?: string): Promise<string> {
    const account = BYTESCALE_CONFIG[subject] || BYTESCALE_CONFIG["admin"];

    if (!account) {
        console.error("[Bytescale] Configuration missing for subject:", subject);
        throw new Error(`Unknown Bytescale account for subject: ${subject}`);
    }

    const { ACCOUNT_ID, PUBLIC_KEY } = account;

    if (!ACCOUNT_ID || !PUBLIC_KEY) {
        console.error("[Bytescale] Missing required config fields:", { ACCOUNT_ID: !!ACCOUNT_ID, PUBLIC_KEY: !!PUBLIC_KEY });
        return "failed";
    }

    const filename = generateFilename(file);

    const fd = new FormData();
    fd.append("file", file, filename);

    const folder = customFolder || new Date().toISOString().split("T")[0];
    const path = `/${subject}/${folder}/${filename}`;

    const res = await fetch(
        `https://api.bytescale.com/v2/accounts/${ACCOUNT_ID}/uploads/form_data?filePath=${encodeURIComponent(path)}`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${PUBLIC_KEY}`,
                // Do NOT set Content-Type, let browser set boundary
            },
            body: fd
        }
    );

    console.log(`[Bytescale] Uploading to ${path} - Status:`, res.status);

    if (!res.ok) {
        const errorText = await res.text();
        console.error("[Bytescale] Upload failed:", res.status, errorText);
        return "failed";
    }

    const data = await res.json();
    console.log("[Bytescale] Upload Success:", data);
    return data.files?.[0]?.fileUrl || "failed";
}

/* -----------------------------
 * Backend signer
 * --------------------------- */

export async function getPrivateFile(filePath: string): Promise<any> {
    const res = await fetch(`/api/get-private-file?filePath=${encodeURIComponent(filePath)}`);
    if (!res.ok) throw new Error("Failed to retrieve file");
    return res.json();
}

/* -----------------------------
 * Detection helpers
 * --------------------------- */

export function isBytescaleUrl(url: string | null | undefined): boolean {
    return typeof url === "string" && url.includes("upcdn.io/");
}

/* -----------------------------
 * Signing
 * --------------------------- */

export async function getBytescaleSignedUrl(url: string | null | undefined): Promise<string> {
    if (!url || !isBytescaleUrl(url)) return url || "";

    try {
        const result = await getPrivateFile(url);
        return typeof result === "string" ? result : url;
    } catch (err) {
        console.error("Failed to sign Upcdn URL:", url, err);
        return url;
    }
}

/* -----------------------------
 * Media helpers
 * --------------------------- */

export function mediaTypeBytescale(url: string): "image" | "video" | "unknown" {
    if (!url) return "unknown";

    const u = url.toLowerCase();

    // Thumbnail pipeline always outputs images
    if (u.includes("/thumbnail/")) return "image";

    const isVideo = /\.(mp4|webm|mov)(\?|$)/.test(u);
    const isImage = /\.(jpg|jpeg|png|gif|webp|avif|bmp|svg)(\?|$)/.test(u);

    if (isImage) return "image";
    if (isVideo) return "video";

    return "unknown";
}

export function getThumbnailBytescale(url: string): string {
    if (!isBytescaleUrl(url)) return url;

    // 1. Force the transformation from /raw/ to /image/ 
    let thumbUrl = url.replace("/raw/", "/image/");

    // 2. Clear any existing params
    thumbUrl = thumbUrl.split('?')[0];

    return `${thumbUrl}?w=300&h=300&fit=cover&f=jpg&q=70`;
}
