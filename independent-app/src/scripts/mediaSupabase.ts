// src/scripts/mediaSupabase.ts
// Supabase Media Upload Handling & Client-Side Compression

import { createClient } from '@/utils/supabase/client';

const VIDEO_EXTS = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'hevc', 'm4v', '3gp', 'wmv', 'flv'];
const HEIC_TYPES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];

/** Detect if a file is a video by MIME type or extension (handles empty type from Android) */
function isVideo(file: File): boolean {
    if (file.type.startsWith('video/')) return true;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    return VIDEO_EXTS.includes(ext);
}

/** Detect if a file is an image (by type or extension) */
function isImage(file: File): boolean {
    if (file.type.startsWith('image/')) return true;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif', 'avif', 'tiff'].includes(ext);
}

/** Safe extension — always lowercase, HEIC/HEIF becomes jpg, fallback to bin */
function safeExt(file: File, outputType?: string): string {
    if (outputType === 'image/jpeg') return 'jpg';
    const raw = file.name.includes('.') ? file.name.split('.').pop()! : '';
    const ext = raw.toLowerCase();
    if (!ext || ext.length > 5) return 'bin';
    if (ext === 'heic' || ext === 'heif') return 'jpg'; // HEIC gets converted to JPEG
    return ext;
}

/** Compress/convert image to JPEG. HEIC and other exotic formats are converted to JPEG. */
async function compressImage(file: File, maxWidth = 1920, quality = 0.8): Promise<{ file: File; type: string }> {
    // GIFs: skip compression (would break animation)
    if (file.type === 'image/gif') return { file, type: file.type };

    // Determine output MIME — HEIC/HEIF must become JPEG (browsers can't encode HEIC)
    const isHeic = HEIC_TYPES.includes(file.type) || ['heic', 'heif'].includes(file.name.split('.').pop()?.toLowerCase() || '');
    const outputMime = isHeic ? 'image/jpeg' : (file.type || 'image/jpeg');

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob) {
                        const safeName = file.name.replace(/\.[^.]+$/, '') + '.' + safeExt(file, outputMime);
                        resolve({ file: new File([blob], safeName, { type: outputMime, lastModified: Date.now() }), type: outputMime });
                    } else {
                        resolve({ file, type: file.type || 'image/jpeg' }); // fallback to original
                    }
                }, outputMime, quality);
            };
            img.onerror = () => resolve({ file, type: file.type || 'image/jpeg' });
        };
        reader.onerror = () => resolve({ file, type: file.type || 'image/jpeg' });
    });
}

function generateFilename(file: File, outputType?: string): string {
    const ext = safeExt(file, outputType);
    let uuid: string;
    try {
        uuid = typeof crypto?.randomUUID === 'function'
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15);
    } catch {
        uuid = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    }
    return `${uuid}.${ext}`;
}

/**
 * Main upload function.
 * @param bucketName 'media' (public) or 'proofs' (private)
 * @param folderPath e.g., 'avatars', 'chat', or 'tasks'
 * @param file The file from the input element
 */
export async function uploadToSupabase(bucketName: string, folderPath: string, file: File): Promise<string> {
    console.log(`[SupabaseStorage] Upload start: name=${file.name} type=${file.type || '(empty)'} size=${file.size}`);

    try {
        // Videos (by MIME or extension) — signed URL, bypasses 4.5MB Vercel body limit
        if (isVideo(file)) {
            return await uploadFileDirectly(bucketName, folderPath, file);
        }

        // Images — compress first, then upload directly via signed URL (same as video)
        if (isImage(file)) {
            const { file: processedFile } = await compressImage(file);
            return await uploadFileDirectly(bucketName, folderPath, processedFile);
        }

        // Unknown file type — direct signed upload
        return await uploadFileDirectly(bucketName, folderPath, file);

    } catch (err: any) {
        console.error('[SupabaseStorage] Upload failed:', err.message);
        return `failed:${err.message || 'unknown'}`;
    }
}

/**
 * Extracts a frame from a video file at ~1s, uploads it as a JPEG thumbnail,
 * and returns the public URL. Returns null silently on any failure.
 */
export async function extractAndUploadVideoThumbnail(videoFile: File): Promise<string | null> {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.crossOrigin = 'anonymous';

        const objectUrl = URL.createObjectURL(videoFile);
        video.src = objectUrl;

        const cleanup = () => { try { URL.revokeObjectURL(objectUrl); } catch { /* ignore */ } };

        // Timeout safety — give up after 30s
        const timeout = setTimeout(() => { cleanup(); resolve(null); }, 30000);

        const grabFrame = async () => {
            clearTimeout(timeout);
            try {
                const maxW = 800;
                const w = Math.min(video.videoWidth || 800, maxW);
                const h = video.videoHeight && video.videoWidth
                    ? Math.round(w * video.videoHeight / video.videoWidth)
                    : Math.round(w * 9 / 16);

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (!ctx) { cleanup(); resolve(null); return; }
                ctx.drawImage(video, 0, 0, w, h);

                canvas.toBlob(async (blob) => {
                    cleanup();
                    if (!blob) { resolve(null); return; }
                    const thumbFile = new File([blob], 'thumb.jpg', { type: 'image/jpeg' });
                    const url = await uploadFileDirectly('media', 'queen_posts_thumbs', thumbFile);
                    console.log('[Thumbnail upload]', url);
                    resolve(url.startsWith('failed') ? null : url);
                }, 'image/jpeg', 0.82);
            } catch (e) {
                console.warn('[Thumbnail] frame grab failed:', e);
                cleanup();
                resolve(null);
            }
        };

        video.onseeked = grabFrame;

        video.onloadeddata = () => {
            // Seek to 1s, or 10% of duration, whichever is less
            const seekTo = Math.min(1, (video.duration || 0) * 0.1);
            if (seekTo > 0 && isFinite(seekTo)) {
                video.currentTime = seekTo;
            } else {
                // Duration unknown — try seeking to 0 and grab immediately
                video.currentTime = 0;
            }
        };

        // If onloadeddata never fires, fall back to onloadedmetadata
        video.onloadedmetadata = () => {
            if (video.readyState >= 2) return; // onloadeddata already handled it
            video.currentTime = Math.min(1, (video.duration || 0) * 0.1);
        };

        video.onerror = () => { clearTimeout(timeout); cleanup(); resolve(null); };
    });
}

async function uploadFileDirectly(bucketName: string, folderPath: string, file: File): Promise<string> {
    const sizeMB = file.size / 1024 / 1024;
    console.log(`[SupabaseStorage] Signed upload: ${file.name} (${sizeMB.toFixed(1)}MB)`);

    // Supabase Pro supports up to 5GB per file
    if (sizeMB > 5000) {
        console.warn(`[SupabaseStorage] File too large: ${sizeMB.toFixed(1)}MB`);
        return `failed:size:${sizeMB.toFixed(0)}MB`;
    }

    try {
        const storagePath = `${folderPath}/${generateFilename(file)}`;

        // 1. Get signed upload URL from backend
        const signRes = await fetch('/api/upload/signed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bucket: bucketName, path: storagePath }),
        });

        if (!signRes.ok) {
            const err = await signRes.json().catch(() => ({}));
            console.error('[SupabaseStorage] Failed to get signed URL:', err);
            return 'failed';
        }

        const { signedUrl, publicUrl } = await signRes.json();

        // 2. PUT directly to Supabase — infer content-type if empty (Android)
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const mimeMap: Record<string, string> = {
            mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
            mkv: 'video/x-matroska', webm: 'video/webm', m4v: 'video/mp4',
            '3gp': 'video/3gpp', hevc: 'video/mp4',
        };
        const contentType = file.type || mimeMap[ext] || 'video/mp4';

        const uploadRes = await fetch(signedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': contentType },
            body: file,
        });

        if (!uploadRes.ok) {
            const body = await uploadRes.text().catch(() => '');
            console.error(`[SupabaseStorage] PUT failed ${uploadRes.status}:`, body);
            // Supabase returns 413 when file exceeds bucket size limit
            if (uploadRes.status === 413 || body.includes('Payload Too Large') || body.includes('size')) {
                return `failed:size:${sizeMB.toFixed(0)}MB`;
            }
            return 'failed';
        }

        console.log('[SupabaseStorage] Video upload success:', publicUrl);
        return publicUrl;
    } catch (err: any) {
        console.error('[SupabaseStorage] Video upload exception:', err.message);
        return 'failed';
    }
}
