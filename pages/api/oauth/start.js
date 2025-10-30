export default function handler(req, res) {
  const { TT_APP_ID, TT_REDIRECT_URI } = process.env;
  if (!TT_APP_ID || !TT_REDIRECT_URI) {
    return res.status(500).json({ error: "missing_env", need: ["TT_APP_ID", "TT_REDIRECT_URI"] });
  }

  // 上传所需的最小权限：ad.account、ad.manage、file.upload
  const scope = ["ad.account", "ad.manage", "file.upload"].join(",");

  const url = new URL("https://business-api.tiktok.com/open_api/v1.3/oauth2/authorize/");
  url.searchParams.set("app_id", TT_APP_ID);
  url.searchParams.set("redirect_uri", TT_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", "ttuploader");
  url.searchParams.set("scope", scope);

  return res.redirect(url.toString());
}
