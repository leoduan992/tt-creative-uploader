// pages/api/auth.js
import axios from "axios";

let cachedToken = null;
let tokenExpiry = 0; // ms
const AUTH_URL = "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/";

export default async function handler(req, res) {
  const { TT_APP_ID, TT_APP_SECRET } = process.env;

  if (!TT_APP_ID || !TT_APP_SECRET) {
    return res.status(400).json({
      error: "missing_env",
      has_APP_ID: !!TT_APP_ID,
      has_APP_SECRET: !!TT_APP_SECRET,
      hint: "在 Vercel 环境变量里填 TT_APP_ID / TT_APP_SECRET",
    });
  }

  if (cachedToken && Date.now() < tokenExpiry) {
    return res.status(200).json({ access_token: cachedToken, cached: true });
  }

  const body = { app_id: TT_APP_ID, secret: TT_APP_SECRET, grant_type: "client_credentials" };

  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await axios.post(AUTH_URL, body, {
        timeout: 60000,
        headers: { "Content-Type": "application/json" },
      });
      const data = r.data;
      const token = data?.data?.access_token || data?.access_token;
      const expiresIn = data?.data?.expires_in || data?.expires_in || 3600;

      if (!token) return res.status(502).json({ error: "no_token_in_response", raw: data });

      cachedToken = token;
      tokenExpiry = Date.now() + (expiresIn - 60) * 1000;
      return res.status(200).json({ access_token: token, expires_in: expiresIn, refreshed: true });
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1))); // 1s -> 2s
    }
  }

  return res.status(500).json({
    error: "token_request_failed",
    details: lastErr?.response?.data || lastErr?.message || "unknown error",
  });
}
