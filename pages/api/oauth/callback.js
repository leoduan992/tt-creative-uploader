// pages/api/oauth/callback.js
// 兼容接收 ?code=xxx 或 ?auth_code=xxx，然后换长期 access_token
export default async function handler(req, res) {
  try {
    const APP_ID = process.env.TT_APP_ID;
    const APP_SECRET = process.env.TT_APP_SECRET;

    if (!APP_ID || !APP_SECRET) {
      return res.status(400).json({ error: "missing_env", need: ["TT_APP_ID", "TT_APP_SECRET"] });
    }

    // 兼容两种返回参数：code（有些入口）/ auth_code（Business API 常用）
    const code = req.query.auth_code || req.query.code;
    if (!code) {
      return res.status(400).json({ error: "missing_code", tip: "授权页未返回 ?auth_code=xxx 或 ?code=xxx" });
    }

    // v1.3 的换 token 接口（JSON）
    const url = "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/";

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: APP_ID,       // v1.3 要求 string
        secret: APP_SECRET,
        auth_code: code
      }),
    });

    const data = await resp.json();

    if (!resp.ok || !data || data.code !== 0 || !data.data?.access_token) {
      return res.status(400).json({ error: "token_exchange_failed", raw: data });
    }

    // 正常返回 access_token、可访问的 advertiser_ids 等
    return res.status(200).json({
      ok: true,
      access_token: data.data.access_token,
      advertiser_ids: data.data.advertiser_ids || [],
      scope: data.data.scope || []
    });
  } catch (e) {
    return res.status(500).json({ error: "callback_error", message: e.message });
  }
}
