import crypto from "crypto";

export default function handler(req, res) {
  const { filePath } = req.query;

  if (!filePath) {
    return res.status(400).json({ error: "Missing filePath" });
  }

  const accountId = process.env.BYTESCALE_ACCOUNT_ID;
  const secretKey = process.env.BYTESCALE_SECRET_KEY;

  const expires = Date.now() + 1000 * 60 * 5; // 5 minutes

  const url = `https://upcdn.io/${accountId}/raw/${filePath}?expires=${expires}`;

  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(url)
    .digest("hex");

  const signedUrl = `${url}&signature=${signature}`;

  res.status(200).json({ url: signedUrl });
}