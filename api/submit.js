export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      name,
      contact,
      agent,
      complainer,
      subject,
      details,
      proofBase64,
      proofMime,
      proofName
    } = req.body || {};

    if (!subject || !details) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const token = process.env.TG_BOT_TOKEN;
    const chatId = process.env.TG_CHAT_ID;

    if (!token || !chatId) {
      return res.status(500).json({ error: "Telegram config missing" });
    }

    const text =
`🧾 CSB Agent Report Box
━━━━━━━━━━━━━━
👤 রিপোর্টকারী নাম: ${name || "N/A"}
📞 যোগাযোগ: ${contact || "N/A"}
🪪 রিপোর্টকারী Agent ID: ${agent || "N/A"}
🚨 অভিযুক্ত Agent ID: ${complainer || "N/A"}
🧷 বিষয়: ${subject}
📝 বিস্তারিত:
${details}
━━━━━━━━━━━━━━`;

    // Helper: send message
    async function sendMessage(messageText) {
      const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: messageText })
      });
      const data = await tg.json().catch(() => ({}));
      return { ok: tg.ok, data };
    }

    // If proof exists -> sendDocument first (with short caption), then send full text as message
    if (proofBase64 && proofMime) {
      const fileBuffer = Buffer.from(proofBase64, "base64");
      const filename = proofName || "proof.png";

      const form = new FormData();
      form.append("chat_id", String(chatId));

      // caption ছোট রাখি (Telegram caption limit)
      const shortCaption = `🧾 CSB Report\n🧷 বিষয়: ${subject}`;
      form.append("caption", shortCaption);

      // file attach
      const blob = new Blob([fileBuffer], { type: proofMime });
      form.append("document", blob, filename);

      const tgDoc = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
        method: "POST",
        body: form
      });

      const docData = await tgDoc.json().catch(() => ({}));
      if (!tgDoc.ok) {
        return res.status(500).json({
          error: "Telegram sendDocument failed",
          data: docData
        });
      }

      // এরপর full details আলাদা message এ পাঠাই
      const msgRes = await sendMessage(text);
      if (!msgRes.ok) {
        return res.status(500).json({
          error: "Telegram sendMessage failed (after document)",
          data: msgRes.data
        });
      }

      return res.status(200).json({ ok: true });
    }

    // No proof -> just send message
    const msgRes = await sendMessage(text);
    if (!msgRes.ok) {
      return res.status(500).json({ error: "Telegram sendMessage failed", data: msgRes.data });
    }

    return res.status(200).json({ ok: true });

  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
}
