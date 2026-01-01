import crypto from "crypto";
//import { BYTESCALE_CONFIG } from "../../js/config";
import { BYTESCALE_CONFIG } from "../lib/config.js";

/**
 * Converts a regular Bytescale File URL into a signed URL.
 *
 * @param fileUrl            E.g. "https://upcdn.io/kW2K8hR/image/example.jpg?w=800&h=600"
 *                           Must be a valid URL (i.e. must already be URL encoded)."
 * @param ttlSeconds         Specify in seconds how long (from now) the URL should remain valid (default: 10 minutes).
 *                           Specify 'null' for infinite expiration.
 * @param ttlIncrementSize   Rounds expiration to this interval to improve CDN caching (default: 60 seconds).
 * @returns                  Signed Bytescale File URL (with the signature in the 'sig' parameter).
 */
function getSignedUrl(fileUrl, apiKeyId, hmacKey, ttlSeconds = 600, ttlIncrementSize = 60) {
  if (!/^(https?:)?\/\//i.test(fileUrl)) {
    throw new Error("Invalid URL: must start with http://, https://, or //");
  }

  // 1. Calculate rounded expiration time (the 'exp' parameter is mandatory for signed URLs)
  const now = Math.floor(Date.now() / 1000);
  const expiration = ttlSeconds === null ? "inf" : Math.ceil((now + ttlSeconds) / ttlIncrementSize) * ttlIncrementSize;
  const expirationParam = `exp=${expiration}`;
  const delimiter = fileUrl.includes("?") ? "&" : "?";
  const urlWithExpiration = `${fileUrl}${delimiter}${expirationParam}`;

  // 2. Prepare schemeless URL string (Bytescale signs without scheme for portability)
  const schemelessUrl = urlWithExpiration.slice(urlWithExpiration.indexOf("//") + 2);

  // 3. Create signature (HMAC SHA-256)
  const signature = crypto.createHmac("sha256", Buffer.from(hmacKey, "base64")).update(schemelessUrl, "utf8").digest("base64url");

  // 4. Construct 'sig' parameter (format: version.apiKeyId.signature)
  const sigParam = `sig=1.${apiKeyId}.${signature}`;

  // 5. Return fully signed URL
  return `${urlWithExpiration}&${sigParam}`;
}

export default async function handler(req, res) {
  const { filePath } = req.query;

  if (!filePath) {
    return res.status(400).json({ error: "Missing filePath" });
  }

  const subject = filePath.split("/")[1];

  // Default to admin if unknown
  const account = BYTESCALE_CONFIG[subject] || BYTESCALE_CONFIG["admin"];

  const { ACCOUNT_ID, API_KEY_ID_ENV, HMAC_KEY_ENV } = account;

  // Get values from environment variables
  const apiKeyId = process.env[API_KEY_ID_ENV];
  const hmacKey = process.env[HMAC_KEY_ENV];

  if (!apiKeyId || !hmacKey) {
    return res.status(500).json({ error: "Server configuration error: missing API credentials" });
  }

  try {
    const fileUrl = `https://upcdn.io/${ACCOUNT_ID}/raw${filePath}`;
    const signedUrl = getSignedUrl(fileUrl, apiKeyId, hmacKey);
    res.json({ url: signedUrl });
  } catch (error) {
    console.error('Signing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
