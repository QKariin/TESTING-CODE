export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const subscription = req.body;

    if (!subscription) {
      return res.status(400).json({ error: "No subscription provided" });
    }

    // Forward subscription to Wix
    const wixResponse = await fetch("https://qkarin.com/_functions/saveSubscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription)
    });

    const data = await wixResponse.json();

    return res.status(200).json({ success: true, wix: data });
  } catch (err) {
    console.error("Error forwarding subscription:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}