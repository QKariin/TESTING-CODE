import crypto from "crypto";
//import { BYTESCALE_CONFIG } from "../../js/config";
import { BYTESCALE_CONFIG } from "../lib/config.js";

export default function handler(req, res) {
  const { filePath } = req.query;

  if (!filePath) {
    return res.status(400).json({ error: "Missing filePath" });
  }

  const subject = filePath.split("/")[1];

  // Default to admin if unknown
  const account = BYTESCALE_CONFIG[subject] || BYTESCALE_CONFIG["admin"];

  const { ACCOUNT_ID, SECRET_KEY_ENV } = account;

  // ✔ Load secret key from Vercel environment
  const secretKey = process.env[SECRET_KEY_ENV];

  if (!secretKey) {
    return res.status(500).json({ error: "Missing secret key in environment" });
  }

  const expires = Date.now() + 1000 * 60 * 5;

  const stringToSign = `${filePath}?expires=${expires}`;
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(stringToSign)
    .digest("hex");

  const url = `https://upcdn.io/${ACCOUNT_ID}/raw${filePath}?expires=${expires}&signature=${signature}`;
}
