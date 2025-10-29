// pages/api/tiktok-chunk/finish.js
import axios from "axios";

export const config = { api: { bodyParser: true, sizeLimit: "1mb" }, runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { TT_ADVERTISER_ID, NEXT_PUBLIC_SITE_URL } = process.env;
  const { upload_id } = req.body || {};
  if (!TT_ADVERTISER_ID) return res.status(400).json({ error: "missing TT_ADVERTISER_ID" });
  if (!upload_id) return res.status(400).json({ error: "missing upload_id" });

  try {
    const site = NEXT_PUBLIC_SITE_URL || "http://localhost:3001";
    const { data: auth } = await axios.get(`${site}/api/auth`, { timeout: 60000 });
    const accessToken = auth?.access_token;
    if (!accessToken) return res.status(500).json({ error: "get_token_failed" });

    const r = await axios.post(
      "https://business-api.tiktok.com/open_api/v1.3/file/finish/upload/",
      { advertiser_id: TT_ADVERTISER_ID, upload_id },
      { headers: { "Access-Token": accessToken, "Content-Type": "application/json" }, timeout: 20000 }
    );

    return res.status(200).json(r.data);
  } catch (e) {
    return res.status(500).json({ error: "finish_failed", details: e.response?.data || e.message });
  }
}
