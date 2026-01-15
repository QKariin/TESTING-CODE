// media.js
import { getThumbnailBytescale } from "./mediaBytescale.js";

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
  if (url.isBytescaleUrl) return mediaTypeBytescale(url);

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
  if (url.isBytescaleUrl) return getThumbnailBytescale(url);
  
  return url;
}

export function getOptimizedUrl(url, width = 400) {
  if (!url || typeof url !== "string") return "";
  if (url.startsWith("data:")) return url;

  // 1. CLOUDINARY
  if (url.includes("cloudinary.com") || url.includes("cloudinary")) {
    return "https://upcdn.io/kW2K8hR/raw/public/collar-192.png";
  }

  // 2. BYTESCALE
  if (url.includes("upcdn.io")) {
    const cleanUrl = getThumbnail(url);
    const sep = cleanUrl.includes("?") ? "&" : "?";
    return `${cleanUrl}${sep}width=${width}&format=auto&quality=auto&dpr=auto`;
  }

  // 3. WIX VECTORS
  if (url.startsWith("wix:vector://v1/")) {
    const id = url.split("/")[3].split("#")[0];
    return `https://static.wixstatic.com/shapes/${id}`;
  }

  // 4. WIX IMAGES
  if (url.startsWith("wix:image://v1/")) {
    const id = url.split("/")[3].split("#")[0];
    return `https://static.wixstatic.com/media/${id}/v1/fill/w_${width},h_${width},al_c,q_80,usm_0.66_1.00_0.01,enc_auto/${id}`;
  }

  // 5. WIX VIDEOS
  if (url.startsWith("wix:video://v1/")) {
    const id = url.split("/")[3].split("#")[0];
    return `https://video.wixstatic.com/video/${id}/mp4/file.mp4`;
  }

  // 6. STANDARD HTTP LINKS → passthrough
  if (url.startsWith("http")) return url;

  // 7. FALLBACK
  return url;
}