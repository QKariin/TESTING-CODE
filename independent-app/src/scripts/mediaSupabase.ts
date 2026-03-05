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
    console.log(`[SupabaseStorage] Starting upload to ${bucketName}/${folderPath}...`);

    try {
        const supabase = createClient();

        // 1. Compress if it's an image
        const processedFile = await compressImage(file);

        // 2. Generate secure filename
        const filename = generateFilename(processedFile);
        const fullPath = `${folderPath.replace(/^\/|\/$/g, '')}/${filename}`; // Clean slashes

        // 3. Upload to Supabase
        const { data, error } = await supabase.storage
            .from(bucketName)
            .upload(fullPath, processedFile, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error("[SupabaseStorage] Upload Error:", error);
            throw error;
        }

        // 4. Return the public URL immediately
        const { data: urlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(fullPath);

        console.log(`[SupabaseStorage] Success:`, urlData.publicUrl);
        return urlData.publicUrl;

    } catch (err: any) {
        console.error("[SupabaseStorage] Upload Failed:", err.message);
        return "failed";
    }
}
