import axios from "axios";

export default async function handler(req, res) {
  const { code, state } = req.query;
  const { TT_APP_ID, TT_APP_SECRET, TT_REDIRECT_URI } = process.env;

  if (!code) {
    return res.status(400).json({ error: "missing_code", tip: "授权页未返回 ?code=xxx" });
  }
  if (!TT_APP_ID || !TT_APP_SECRET || !TT_REDIRECT_URI) {
    return res.status(500).json({ error: "missing_env", need: ["TT_APP_ID","TT_APP_SECRET","TT_REDIRECT_URI"] });
  }

  try {
    const r = await axios.post(
      "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/",
      {
        app_id: TT_APP_ID,          // v1.3 是 string
        secret: TT_APP_SECRET,
        auth_code: code              // 关键：用授权码换长期 access_token
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 20000
      }
    );

    // TikTok 返回形如 { code, message, data:{ access_token, advertiser_ids, scope } }
    return res.status(200).json({
      ok: true,
      tip: "复制 data.access_token，去 Vercel 环境变量写入 TT_ACCESS_TOKEN 后 Redeploy 即可",
      raw: r.data
    });
  } catch (err) {
    return res.status(500).json({
      error: "exchange_failed",
      details: err.response?.data || err.message
    });
  }
}
