// media.js - FINAL ROBUST VERSION
import { getThumbnailBytescale, isBytescaleUrl, getBytescaleSignedUrl, mediaTypeBytescale } from "./mediaBytescale.js";

export function fileType(file) {
  if (!file) return "unknown";

  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (type.startsWith("video/")) return "video";
  if (type.startsWith("image/")) return "image";

  if (/\.(mp4|mov|webm)$/i.test(name)) return "video";
  if (/\.(jpg|jpeg|png|gif|webp|avif|bmp|svg)$/i.test(name)) return "image";

  return "unknown";
}

export function mediaType(url) {
  if (!url) return "unknown";

  const originalUrl = url.toLowerCase();

  // 1. Bytescale Check
  if (isBytescaleUrl(url)) return mediaTypeBytescale(url);

  // 2. Explicit Wix Protocol Check (The Fix)
  if (originalUrl.startsWith('wix:image')) return "image";
  if (originalUrl.startsWith('wix:video')) return "video";

  // 3. Extension Check
  const isVideoExt = /\.(mp4|webm|mov)(\?|$)/.test(originalUrl);
  const isImageExt = /\.(jpg|jpeg|png|gif|webp|avif|bmp|svg)(\?|$)/.test(originalUrl);

  if (isImageExt) return "image";
  if (isVideoExt) return "video";

  return "unknown";
}

export function getThumbnail(url) {
  if (!url) return url;
  if (isBytescaleUrl(url)) return getThumbnailBytescale(url);
  return getOptimizedUrl(url, 200); // Fallback to optimized wix
}

export function getOptimizedUrl(url, width = 400) {
  if (!url || typeof url !== "string") return "";
  if (url.startsWith("data:")) return url;
  if (url.startsWith("blob:")) return url;

  // 1. CLOUDINARY
  if (url.includes("cloudinary.com")) {
    return "https://upcdn.io/kW2K8hR/raw/public/collar-192.png"; // Placeholder or logic
  }

  // 2. BYTESCALE
  if (url.includes("upcdn.io")) {
    if (url.includes("&sig=")) return url;
    let clean = url.replace("/raw/", "/image/").replace("/thumbnail/", "/image/");
    clean = clean.split('?')[0];
    return `${clean}?w=${width}&h=${width}&fit=cover&q=80&f=jpg`;
  }

  // 3. WIX VECTORS
  if (url.startsWith("wix:vector://")) {
    const parts = url.split("/");
    const id = parts[3] ? parts[3].split("#")[0] : "";
    if (id) return `https://static.wixstatic.com/shapes/${id}`;
  }

  // 4. WIX IMAGES (ROBUST FIX)
  // Structure: wix:image://v1/<ID>/<Name>
  if (url.startsWith("wix:image://")) {
    try {
        const parts = url.split('/');
        // parts[3] is ALWAYS the ID in wix protocol
        const id = parts[3]; 
        if (id) {
            // Remove any hash params like #originWidth
            const cleanId = id.split('#')[0];
            return `https://static.wixstatic.com/media/${cleanId}/v1/fill/w_${width},h_${width},al_c,q_80/file.jpg`;
        }
    } catch (e) {
        console.error("Wix Image Parse Error", e);
    }
  }

  // 5. WIX VIDEOS (ROBUST FIX)
  // Structure: wix:video://v1/<ID>/<Name>
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

  // 6. STANDARD HTTP LINKS
  if (url.startsWith("http")) return url;

  // 7. FALLBACK
  return url;
}

export async function getSignedUrl(url) {
  if (!url) return "";
  if (isBytescaleUrl(url)) {
    return await getBytescaleSignedUrl(url);
  }
  return url;
}
