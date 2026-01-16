import { BYTESCALE_CONFIG } from "../lib/config.js";

/* -----------------------------
 * Upload
 * --------------------------- */

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

/* -----------------------------
 * Backend signer
 * --------------------------- */

export async function getPrivateFile(filePath) {
  const res = await fetch(`/api/get-private-file?filePath=${encodeURIComponent(filePath)}`);
  if (!res.ok) throw new Error("Failed to retrieve file");
  return res.json();
}

/* -----------------------------
 * Detection helpers
 * --------------------------- */

export function isBytescaleUrl(url) {
  return typeof url === "string" && url.includes("upcdn.io/");
}

/*export function isNotSigned(url) {
  console.log("isNotSigned CHECK:", url);

  if (!isBytescaleUrl(url)) return false;

  const params = new URL(url).searchParams;

  if (params.has("sig")) {
    console.log("Already signed → skip");
    return false;
  }

  console.log("Needs signing → true");
  return true;
}*/

/* -----------------------------
 * URL parsing helpers
 * --------------------------- */

function extractQueryString(url) {
  const i = url.indexOf("?");
  return i !== -1 ? url.slice(i) : "";
}

function extractFilePath(url) {
  // Matches: upcdn.io/{accountId}/raw/... or /thumbnail/...
  const match = url.match(/upcdn\.io\/[^/]+\/(?:raw|thumbnail)\/(.+?)(?:\?|$)/);
  if (!match) return null;
  return "/" + match[1];
}

/* -----------------------------
 * Signing
 * --------------------------- */

export async function getBytescaleSignedUrl(url) {
  if (!isBytescaleUrl(url)) return url;

  try {
    const result = await getPrivateFile(url);
    const signed = typeof result === "string" ? result : url;

    let finalUrl = signed;

    return finalUrl;

  } catch (err) {
    console.error("Failed to sign Upcdn URL:", url, err);
    return url;
  }
}

/* -----------------------------
 * Media helpers
 * --------------------------- */

export function mediaTypeBytescale(url) {
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

export function getThumbnailBytescale(url) {
  if (!isBytescaleUrl(url)) return url;
  return url.replace("/raw/", "/thumbnail/");
  /*return url
    .replace("/raw/", "/raw/") // keep raw
    + `?width=${size}&height=${size}&fit=cover&format=jpg`;*/

}

/* -----------------------------
 * DOM pipeline (sign existing + new)
 * --------------------------- */

async function processMediaElement(el) {
  const attrs = ["src"];

  for (const attr of attrs) {
    const original = el.getAttribute(attr);
    if (isNotSigned(original)) {
      const signed = await getSignedUrl(original);
      el.setAttribute(attr, signed);
    }
  }
}

/*export async function scanExisting() {
  console.log("Scanning existing media elements for Bytescale URLs...");
  const elements = document.querySelectorAll("img, video");
  for (const el of elements) {
    await processMediaElement(el);
  }
}*/

/*export function observeNewElements() {
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      // 1. Newly added nodes
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return; // element only

          if (node.tagName === "IMG" || node.tagName === "VIDEO") {
            processMediaElement(node);
          }

          node.querySelectorAll?.("img, video").forEach(processMediaElement);
        });
      }

      // 2. Attribute changes
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
}*/