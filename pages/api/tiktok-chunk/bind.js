// pages/api/tiktok-chunk/bind.js
import axios from "axios";

export const config = { api: { bodyParser: true, sizeLimit: "2mb" }, runtime: "nodejs" };

// 把 file_id 绑定进入广告账户素材库视频：UPLOAD_BY_FILE_ID
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { TT_ADVERTISER_ID, NEXT_PUBLIC_SITE_URL } = process.env;
  const { file_id, file_name, flaw_detect = false, auto_fix_enabled = false, auto_bind_enabled = false } = req.body || {};

  if (!TT_ADVERTISER_ID) return res.status(400).json({ error: "missing TT_ADVERTISER_ID" });
  if (!file_id) return res.status(400).json({ error: "missing file_id" });

  try {
    const site = NEXT_PUBLIC_SITE_URL || "http://localhost:3001";
    const { data: auth } = await axios.get(`${site}/api/auth`, { timeout: 60000 });
    const accessToken = auth?.access_token;
    if (!accessToken) return res.status(500).json({ error: "get_token_failed" });

    const payload = {
      advertiser_id: TT_ADVERTISER_ID,
      upload_type: "UPLOAD_BY_FILE_ID",
      file_id,
      file_name: file_name || undefined,
      flaw_detect: !!flaw_detect,
      auto_fix_enabled: !!auto_fix_enabled,
      auto_bind_enabled: !!auto_bind_enabled,
    };

    const r = await axios.post(
      "https://business-api.tiktok.com/open_api/v1.3/file/video/ad/upload/",
      payload,
      { headers: { "Access-Token": accessToken, "Content-Type": "application/json" }, timeout: 30000 }
    );

    return res.status(200).json(r.data);
  } catch (e) {
    return res.status(500).json({ error: "bind_failed", details: e.response?.data || e.message });
  }
}
