import { BYTESCALE_CONFIG } from "../lib/config.js";

function generateFilename(originalFile) {
  const ext = originalFile.name.split(".").pop();
  return `${crypto.randomUUID()}.${ext}`;
}

export async function uploadToBytescale(subject, file, customFolder) {
  const account = BYTESCALE_CONFIG[subject] || BYTESCALE_CONFIG["admin"];
  if (!account) throw new Error("Unknown Bytescale account");

  const { ACCOUNT_ID, PUBLIC_KEY } = account;

  const filename = generateFilename(file);

  const fd = new FormData();
  fd.append("file", file, filename);

  const folder = customFolder || new Date().toISOString().split("T")[0];
  const path = `/${subject}/${folder}/${filename}`;

  const res = await fetch(
    `https://api.bytescale.com/v2/accounts/${ACCOUNT_ID}/uploads/form_data?filePath=${encodeURIComponent(path)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${PUBLIC_KEY}` },
      body: fd
    }
  );

  if (!res.ok) return "failed";

  const data = await res.json();
  return data.files?.[0]?.fileUrl || "failed";
}

export async function getPrivateFile(filePath) {
  const res = await fetch(`/api/get-private-file?filePath=${encodeURIComponent(filePath)}`);
  if (!res.ok) throw new Error('Failed to retrieve file');
  return res.json();
  //const blob = await res.blob();
  //return URL.createObjectURL(blob);
}

export function isBytescaleUrl(url) {
  if (!url || typeof url !== "string") return false;
  if (!url.includes("upcdn.io")) return false;
  if (!url.includes("/raw/")) return false;

  const hasQuery = url.includes("?");
  if (!hasQuery) return true; // raw, unsigned

  // If it has a query, only allow it if it's already signed
  const params = new URL(url).searchParams;

  // Already signed → ignore
  if (params.has("sig")) return false;

  // Any other query param → transformed → DO NOT SIGN
  return false;
}

function extractQueryString(url) {
  const queryIndex = url.indexOf('?');
  return queryIndex !== -1 ? url.slice(queryIndex) : '';
}

async function signUrl(url) {
  const filePath = extractFilePath(url);
  const query = extractQueryString(url);

  if (!filePath) return url;

  const result = await getPrivateFile(filePath);
  if (!result?.signedUrl) return url;

  // If your backend already includes the query string in the signed URL, skip appending
  const signedHasQuery = result.signedUrl.includes('?');
  return signedHasQuery ? result.signedUrl : result.signedUrl + query;
}

function extractFilePath(url) {
  const parts = url.split('/raw/');
  if (parts.length !== 2) return null;

  const [pathOnly] = parts[1].split('?'); // strip query params
  return '/' + pathOnly;
}

/*function extractFilePath(url) {
  // Example: https://upcdn.io/.../raw/folder/file.jpg
  const parts = url.split('/raw/');
  if (parts.length !== 2) return null;
  return '/' + parts[1]; // "/folder/file.jpg"
}*/

async function processMediaElement(el) {
  const attrs = ["src"];

  for (const attr of attrs) {
    const original = el.getAttribute(attr);
    if (isBytescaleUrl(original)) {
      const signed = await signUrl(original);
      el.setAttribute(attr, signed);
    }
  }
}

export async function scanExisting() {
  console.log("Scanning existing media elements for Bytescale URLs...");
  const elements = document.querySelectorAll("img, video");
  for (const el of elements) {
    await processMediaElement(el);
  }
}

export function observeNewElements() {
const observer = new MutationObserver(mutations => {
  for (const mutation of mutations) {

    // 1. Handle newly added nodes
    if (mutation.type === "childList") {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return; // element only

        // If the node itself is an <img> or <video>
        if (node.tagName === "IMG" || node.tagName === "VIDEO") {
          processMediaElement(node);
        }

        // If the node contains images/videos inside it
        node.querySelectorAll?.("img, video").forEach(processMediaElement);
      });
    }

    // 2. Handle attribute changes (fallback)
    if (mutation.type === "attributes") {
      if (mutation.target.tagName === "IMG" || mutation.target.tagName === "VIDEO") {
        processMediaElement(mutation.target);
      }
    }
  }
});

observer.observe(document.body, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ["src"]
});

}

export async function signUpcdnUrl(url) {
  if (!url || !url.startsWith("https://upcdn.io/")) return url;

  console.log("Signing Upcdn URL:", url);

  // Split raw or thumbnail
  const parts = url.split(/\/raw\/|\/thumbnail\//);
  if (parts.length !== 2) return url;

  // Extract path + query
  const [pathWithExt, query = ""] = parts[1].split("?");

  console.log("Extracted file path:", pathWithExt);

  const filePath = "/" + pathWithExt;

  try {
    const signedUrl = await getPrivateFile(filePath);

    // Re-append query params if they existed
    if (query) {
      return `${signedUrl}?${query}`;
    }

    return signedUrl || url;
  } catch (err) {
    console.error("Failed to sign Upcdn URL:", url, err);
    return url;
  }
}

export function mediaTypeBytescale(url) {
  if (!url) return "unknown";

  const originalUrl = url.toLowerCase();

  // 1. Thumbnail always means image — even if it ends with .mp4
  if (originalUrl.includes("/thumbnail/")) {
    return "image";
  }

  // 2. Raw keeps the original type — so extension matters
  //    (If neither raw nor thumbnail is present, treat like raw)
  const isVideoExt = /\.(mp4|webm|mov)(\?|$)/.test(originalUrl);
  const isImageExt = /\.(jpg|jpeg|png|gif|webp|avif|bmp|svg)(\?|$)/.test(originalUrl);

  if (isImageExt) return "image";
  if (isVideoExt) return "video";

  return "unknown";
}

export function getThumbnailBytescale(url) {
  if (!url) return url;

  // Only operate on Bytescale URLs
  if (!url.includes("upcdn.io")) return url;

  // Replace /raw/ with /thumbnail/
  return url.replace("/raw/", "/thumbnail/");
}