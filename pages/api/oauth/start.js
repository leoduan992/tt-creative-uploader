// pages/api/oauth/start.js
// 触发商业广告 API 的授权页（v1.3），并带上 redirect_uri 与 scope
export default async function handler(req, res) {
  const APP_ID = process.env.TT_APP_ID;
  const REDIRECT_URI = process.env.TT_REDIRECT_URI;     // 形如 https://<你的域名>/api/oauth/callback

  if (!APP_ID || !REDIRECT_URI) {
    return res.status(400).json({ error: "missing_env", need: ["TT_APP_ID", "TT_REDIRECT_URI"] });
  }

  // 建议最小可用权限：广告账户、管理、文件上传
  //（如需更多按需添加）
  const scope = [
    "ad.account",
    "ad.manage",
    "file.upload",
    // "user.info.basic"  // 通常 open api 才会用，不必要求
  ];

  // Business API 的授权地址（注意不是 open.tiktokapis，而是 business-api）
  const authorizeURL = new URL("https://business-api.tiktok.com/open_api/v1.3/oauth2/authorize/");
  authorizeURL.searchParams.set("app_id", APP_ID);
  authorizeURL.searchParams.set("redirect_uri", REDIRECT_URI);
  authorizeURL.searchParams.set("state", "ttuploader_" + Date.now());
  // 部分文档无需 scope；若你的应用在平台侧配置了 scope，这里可不传。
  // 如果需要传，使用逗号分隔
  authorizeURL.searchParams.set("scope", scope.join(","));

  // 有些文档要求 response_type=code；加上更保险
  authorizeURL.searchParams.set("response_type", "code");

  // 302 跳转到授权页
  res.writeHead(302, { Location: authorizeURL.toString() });
  res.end();
}
