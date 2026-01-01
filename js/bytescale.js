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
  if (!url || typeof url !== "string") return false;
  if (url === "undefined") return false;
  if (!url.includes("upcdn.io")) return false;
  if (url.includes("&sig=") || url.includes("?sig=")) return false;
  return true;
}

async function signUrl(url) {
  const { signedUrl } = await getPrivateFile(url);
  return signedUrl;
}

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
  if (el.tagName === "VIDEO") {
    const sources = el.querySelectorAll("source");
    for (const source of sources) {
      const src = source.getAttribute("src");
      if (isUpcdnUrl(src)) {
        const signed = await signUrl(src);
        source.setAttribute("src", signed);
      }
    }
  }
}

export async function scanExisting() {
  const elements = document.querySelectorAll("img, video");
  for (const el of elements) {
    await processMediaElement(el);
  }
}

export function observeNewElements() {
  const observer = new MutationObserver(async (mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;

        if (node.matches?.("img, video")) {
          await processMediaElement(node);
        }

        const nested = node.querySelectorAll?.("img, video");
        for (const el of nested) {
          await processMediaElement(el);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Run
//scanExisting();
//observeNewElements();