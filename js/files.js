// bytescale-upload.js

const BS1_ACCOUNT_ID = "kW2K8hR";
const BS1_API_KEY = "public_kW2K8hR6YbQXStTvMf5ZDYbVf1fQ"; // safe for frontend

// Generate a safe filename
function generateFilename(originalFile) {
  const ext = originalFile.name.split(".").pop();
  return `${crypto.randomUUID()}.${ext}`;
}

// Upload to Bytescale
export async function uploadToBytescale(subject, file) {
  const filename = generateFilename(file);

  const fd = new FormData();
  fd.append("file", file, filename);

  // Create a YYYY-MM-DD folder
  const now = new Date();
  const dateFolder = now.toISOString().split("T")[0]; // "2025-01-28"

  // Path: members/{location}/{date}
  const path = `${subject}/${dateFolder}`;

  if (subject === "admin") {
    ACCOUNT_ID  = BS1_ACCOUNT_ID
    API_KEY     = BS1_API_KEY
  } else {
    ACCOUNT_ID  = BS1_ACCOUNT_ID
    API_KEY     = BS1_API_KEY
  }

  const res = await fetch(
    `https://api.bytescale.com/v2/accounts/${ACCOUNT_ID}/uploads/form_data?path=${path}`,
    {
      method: "POST",
      headers: { "Authorization": `Bearer ${API_KEY}` },
      body: fd
    }
  );

  if (!res.ok) {
    throw new Error("Bytescale upload failed");
  }

  const data = await res.json();
  return data.files?.[0]?.fileUrl || null;
}

export async function getPrivateFile(filePath) {
  const res = await fetch(`/api/get-private-file?filePath=${encodeURIComponent(filePath)}`);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to retrieve file");
  }

  return data.url; // signed URL
}