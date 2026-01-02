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

function isUpcdnUrl(url) {
  console.log("isUpcdnUrl check:", url);
  if (!url || typeof url !== "string") return false;
  if (url === "undefined") return false;
  if (!url.includes("upcdn.io")) return false;
  if (url.includes("&sig=") || url.includes("?sig=")) return false;
  return true;
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
  const attrs = ["src", "poster"];

  for (const attr of attrs) {
    const original = el.getAttribute(attr);
    if (isUpcdnUrl(original)) {
      const signed = await signUrl(original);
      el.setAttribute(attr, signed);
    }
  }

  // Handle <video><source></source></video>
  /*if (el.tagName === "VIDEO") {
    const sources = el.querySelectorAll("source");
    for (const source of sources) {
      const src = source.getAttribute("src");
      if (isUpcdnUrl(src)) {
        const signed = await signUrl(src);
        source.setAttribute("src", signed);
      }
    }
  }*/
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
      console.log("MUTATION:", mutation.attributeName, el.getAttribute(mutation.attributeName));
      if (mutation.type !== "attributes") continue;
      if (mutation.attributeName !== "src" && mutation.attributeName !== "data-src") continue;

      const el = mutation.target;
      const url = el.getAttribute(mutation.attributeName);

      // Skip null/empty
      if (!url || typeof url !== "string") continue;

      // Skip already-signed URLs
      if (url.includes("&sig=") || url.includes("?sig=")) continue;

      // Skip non-Upcdn URLs
      if (!url.includes("upcdn.io")) continue;

      // Prevent feedback loop
      observer.disconnect();

      signUrlAsync(url).then(signedUrl => {
        // Only update if still the same unsigned URL
        const current = el.getAttribute(mutation.attributeName);
        if (current === url) {
          el.setAttribute(mutation.attributeName, signedUrl);
        }

        // Reconnect observer
        observer.observe(document.body, {
          subtree: true,
          attributes: true,
          attributeFilter: ["src", "data-src"]
        });
      });
    }
  });

  observer.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "data-src"]
  });
}

// Run
//scanExisting();
//observeNewElements();