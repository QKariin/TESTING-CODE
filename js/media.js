// media.js
import { getThumbnailBytescale, isBytescaleUrl, getBytescaleSignedUrl, mediaTypeBytescale } from "./mediaBytescale.js";

export function fileType(file) {
  if (!file) return "unknown";

  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (type.startsWith("video/")) return "video";
  if (type.startsWith("image/")) return "image";

  // fallback to extension
  if (/\.(mp4|mov|webm)$/i.test(name)) return "video";
  if (/\.(jpg|jpeg|png|gif|webp|avif|bmp|svg)$/i.test(name)) return "image";

  return "unknown";
}

export function mediaType(url) {
  if (!url) return "unknown";

  const originalUrl = url.toLowerCase();

  // 1. Thumbnail always means image — even if it ends with .mp4
  if (isBytescaleUrl(url)) return mediaTypeBytescale(url);

  // 2. Raw keeps the original type — so extension matters
  //    (If neither raw nor thumbnail is present, treat like raw)
  const isVideoExt = /\.(mp4|webm|mov)(\?|$)/.test(originalUrl);
  const isImageExt = /\.(jpg|jpeg|png|gif|webp|avif|bmp|svg)(\?|$)/.test(originalUrl);

  if (isImageExt) return "image";
  if (isVideoExt) return "video";

  return "unknown";
}

export function getThumbnail(url) {
  if (!url) return url;

  // Only operate on Bytescale URLs
  if (isBytescaleUrl(url)) return getThumbnailBytescale(url);

  return url;
}

export function getOptimizedUrl(url, width = 400) {
  if (!url || typeof url !== "string") return "";
  if (url.startsWith("data:")) return url;

  // 1. CLOUDINARY
  if (url.includes("cloudinary.com") || url.includes("cloudinary")) {
    return "https://upcdn.io/kW2K8hR/raw/public/collar-192.png";
  }

  // 2. BYTESCALE (CLEAN REWRITE)
  if (url.includes("upcdn.io")) {
    if (url.includes("&sig=")) return url; // Already signed

    // Fix: Do not use getThumbnail() here as it hardcodes w=300
    // 1. Force transformation endopint
    let clean = url.replace("/raw/", "/image/").replace("/thumbnail/", "/image/");

    // 2. Strip existing params to ensure clean state
    clean = clean.split('?')[0];

    // 3. Apply requested width and auto format
    // Note: Bytescale uses 'w' and 'h'. Chat asks for 600.
    return `${clean}?w=${width}&h=${width}&fit=cover&q=80&f=auto`;
  }

  // 3. WIX VECTORS
  if (url.startsWith("wix:vector://")) {
    const parts = url.split("/");
    const id = parts[3] ? parts[3].split("#")[0] : "";
    if (id) return `https://static.wixstatic.com/shapes/${id}`;
  }

  // 4. WIX IMAGES (ROBUST REGEX)
  if (url.startsWith("wix:image://")) {
    // Expected format: wix:image://v1/<uri>/<filename>#originWidth=...
    // We just need the <uri> which is usually the 4th segment (index 3)
    const matches = url.match(/wix:image:\/\/v1\/([^/]+)\//);
    if (matches && matches[1]) {
      const id = matches[1];
      return `https://static.wixstatic.com/media/${id}/v1/fill/w_${width},h_${width},al_c,q_80,usm_0.66_1.00_0.01,enc_auto/file.jpg`;
    }

    // Fallback: Try simple split if regex fails (e.g. valid v1 but weird filename)
    const parts = url.split("/");
    if (parts.length >= 4) {
      const id = parts[3];
      return `https://static.wixstatic.com/media/${id}/v1/fill/w_${width},h_${width},al_c,q_80,usm_0.66_1.00_0.01,enc_auto/file.jpg`;
    }
  }

  // 5. WIX VIDEOS
  if (url.startsWith("wix:video://")) {
    const matches = url.match(/wix:video:\/\/v1\/([^/]+)\//);
    if (matches && matches[1]) {
      return `https://video.wixstatic.com/video/${matches[1]}/mp4/file.mp4`;
    }
  }

  // 6. STANDARD HTTP LINKS → passthrough
  if (url.startsWith("http")) return url;

  // 7. FALLBACK
  return url;
}

export async function getSignedUrl(url) {
  if (!url) return "";

  // Only sign Bytescale URLs
  if (isBytescaleUrl(url)) {
    return await getBytescaleSignedUrl(url);
  }

  // Everything else passes through unchanged
  return url;
}
