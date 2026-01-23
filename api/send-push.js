import webpush from "web-push";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

webpush.setVapidDetails(
  "mailto:none",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { title, body, url } = req.body;

    // Fetch all subscriptions from Wix
    const wixResponse = await fetch("https://qkarin.com/_functions/getSubscriptions");
    const subscriptions = await wixResponse.json();

    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
      return res.status(200).json({ success: true, message: "No subscribers" });
    }

    const payload = JSON.stringify({
      title: title || "Notification",
      body: body || "",
      url: url || "/"
    });

    // Send to each subscription
    const results = [];
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(sub, payload);
        results.push({ endpoint: sub.endpoint, status: "sent" });
      } catch (err) {
        results.push({ endpoint: sub.endpoint, status: "failed", error: err.message });
      }
    }

    return res.status(200).json({ success: true, results });
  } catch (err) {
    console.error("Push error:", err);
    return res.status(500).json({ error: "Failed to send push" });
  }
}