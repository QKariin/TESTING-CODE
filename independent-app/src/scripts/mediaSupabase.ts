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

        // Images — compress + convert HEIC→JPEG, then proxy through API (supabaseAdmin)
        if (isImage(file)) {
            const { file: processedFile, type: outputType } = await compressImage(file);

            const formData = new FormData();
            formData.append('file', processedFile);
            formData.append('bucket', bucketName);
            formData.append('folder', folderPath);
            formData.append('ext', safeExt(file, outputType)); // tell server the safe extension

            const response = await fetch('/api/upload', { method: 'POST', body: formData });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({ error: 'Unknown server error' }));
                console.error('[SupabaseStorage] Proxy error:', response.status, errData);
                throw new Error(errData.error || `Upload failed (${response.status})`);
            }

            const data = await response.json();
            console.log('[SupabaseStorage] Proxy success:', data.url);
            return data.url;
        }

        // Unknown file type — try proxy anyway
        const formData = new FormData();
        formData.append('file', file);
        formData.append('bucket', bucketName);
        formData.append('folder', folderPath);
        const response = await fetch('/api/upload', { method: 'POST', body: formData });
        if (!response.ok) throw new Error(`Upload failed (${response.status})`);
        return (await response.json()).url;

    } catch (err: any) {
        console.error('[SupabaseStorage] Upload failed:', err.message);
        return 'failed';
    }
}

async function uploadFileDirectly(bucketName: string, folderPath: string, file: File): Promise<string> {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    console.log(`[SupabaseStorage] Signed upload: ${file.name} (${sizeMB}MB)`);
    try {
        const storagePath = `${folderPath}/${generateFilename(file)}`;

        // 1. Request a signed upload URL from the backend (uses supabaseAdmin, no RLS)
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

        // 2. Upload directly from browser using the signed URL — no serverless size limit
        // Infer content-type from extension if MIME is empty (common on Android)
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
            console.error('[SupabaseStorage] Signed upload PUT failed:', uploadRes.status);
            return 'failed';
        }

        console.log('[SupabaseStorage] Video signed upload success:', publicUrl);
        return publicUrl;
    } catch (err: any) {
        console.error('[SupabaseStorage] Video signed upload exception:', err.message);
        return 'failed';
    }
}
