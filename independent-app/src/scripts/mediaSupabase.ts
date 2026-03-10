// src/scripts/mediaSupabase.ts
// Supabase Media Upload Handling & Client-Side Compression

import { createClient } from '@/utils/supabase/client';

/**
 * Helper to compress images on the client side before upload.
 * Reduces bandwidth and storage usage (replaces Bytescale's server-side optimization).
 */
async function compressImage(file: File, maxWidth: number = 1920, quality: number = 0.8): Promise<File> {
    if (!file.type.startsWith('image/')) return file;
    // Don't compress GIFs as it breaks animation
    if (file.type === 'image/gif') return file;

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob) {
                        const newFile = new File([blob], file.name, {
                            type: file.type || 'image/jpeg',
                            lastModified: Date.now(),
                        });
                        resolve(newFile);
                    } else {
                        resolve(file); // Fallback to original
                    }
                }, file.type || 'image/jpeg', quality);
            };
            img.onerror = () => resolve(file); // Fallback on error
        };
        reader.onerror = () => resolve(file);
    });
}

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

/**
 * Main upload function.
 * @param bucketName 'media' (public) or 'proofs' (private)
 * @param folderPath e.g., 'avatars', 'chat', or 'tasks' 
 * @param file The file from the input element
 */
export async function uploadToSupabase(bucketName: string, folderPath: string, file: File): Promise<string> {
    console.log(`[SupabaseStorage] Starting upload to ${bucketName}/${folderPath}... type=${file.type} size=${file.size}`);

    try {
        // Videos upload directly from client to avoid the 4.5MB API route body limit
        if (file.type.startsWith('video/')) {
            return await uploadVideoDirectly(bucketName, folderPath, file);
        }

        // Images: compress then proxy through API route
        const processedFile = await compressImage(file);

        const formData = new FormData();
        formData.append('file', processedFile);
        formData.append('bucket', bucketName);
        formData.append('folder', folderPath);

        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({ error: 'Unknown server error' }));
            console.error("[SupabaseStorage] Proxy Error Status:", response.status, errData);
            throw new Error(errData.error || `Upload failed (${response.status})`);
        }

        const data = await response.json();
        console.log(`[SupabaseStorage] Proxy success:`, data.url);
        return data.url;

    } catch (err: any) {
        console.error("[SupabaseStorage] Upload Failed:", err.message);
        return "failed";
    }
}

async function uploadVideoDirectly(bucketName: string, folderPath: string, file: File): Promise<string> {
    console.log(`[SupabaseStorage] Video upload via admin proxy: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
    try {
        // Use the admin API route — supabaseAdmin bypasses RLS, File uploaded directly (no Buffer)
        const formData = new FormData();
        formData.append('file', file);
        formData.append('bucket', bucketName);
        formData.append('folder', folderPath);

        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('[SupabaseStorage] Video proxy error:', response.status, errData);
            return 'failed';
        }

        const data = await response.json();
        console.log('[SupabaseStorage] Video upload success:', data.url);
        return data.url;
    } catch (err: any) {
        console.error('[SupabaseStorage] Video upload exception:', err.message);
        return 'failed';
    }
}
