import crypto from "crypto";
//import { BYTESCALE_CONFIG } from "../../js/config";
import { BYTESCALE_CONFIG } from "../lib/config.js";

export default async function handler(req, res) {
  const { filePath } = req.query;

  if (!filePath) {
    return res.status(400).json({ error: "Missing filePath" });
  }

  const subject = filePath.split("/")[1];

  // Default to admin if unknown
  const account = BYTESCALE_CONFIG[subject] || BYTESCALE_CONFIG["admin"];

  const { ACCOUNT_ID, PUBLIC_KEY } = account;

  try {
    const response = await fetch(`https://upcdn.io/${ACCOUNT_ID}/raw${filePath}`, {
      headers: { Authorization: `Bearer ${PUBLIC_KEY}` }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch file' });
    }

    const buffer = await response.arrayBuffer();
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
