import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import formidable from "formidable";

// ✅ 在 pages API 路由里 runtime 放在 config 里；并关闭内置 bodyParser
export const config = {
  api: {
    bodyParser: false,   // 自己解析 multipart
    sizeLimit: "2gb",
  },
  runtime: "nodejs",
};

// 解析 multipart/form-data
function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      multiples: false,
      keepExtensions: true,
      maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB
    });
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { TT_BUSINESS_CENTER_ID, TT_ADVERTISER_ID } = process.env;

  try {
    // 1) 解析表单
    const { fields, files } = await parseForm(req);
    const target = (fields.target || "bc").toString(); // 'bc' 或 'ad'
    const upFile = files.file;
    if (!upFile) return res.status(400).json({ error: "缺少文件 file" });

    // 2) 获取（或自动刷新）Access Token
    const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001";
    const authRes = await axios.get(`${site}/api/auth`);
    const accessToken = authRes.data?.access_token;
    if (!accessToken) return res.status(500).json({ error: "获取 Access Token 失败" });

    // 3) 组装 TikTok 上传请求
    const fd = new FormData();
    fd.append("file", fs.createReadStream(upFile.filepath), {
      filename: upFile.originalFilename || "video.mp4",
      contentType: upFile.mimetype || "video/mp4",
    });

    let uploadUrl = "";
    if (target === "bc") {
      if (!TT_BUSINESS_CENTER_ID) {
        return res.status(400).json({ error: "缺少 TT_BUSINESS_CENTER_ID（BC 素材库上传需要）" });
      }
      uploadUrl = "https://business-api.tiktok.com/open_api/v1.3/file/upload/";
      fd.append("business_center_id", TT_BUSINESS_CENTER_ID);
    } else {
      if (!TT_ADVERTISER_ID) {
        return res.status(400).json({ error: "缺少 TT_ADVERTISER_ID（广告账户素材库上传需要）" });
      }
      uploadUrl = "https://business-api.tiktok.com/open_api/v1.3/file/video/ad/upload/";
      fd.append("advertiser_id", TT_ADVERTISER_ID);
      // 可选：fd.append("upload_type", "UPLOAD_BY_FILE");
    }

    // 4) 发起上传
    const resp = await axios.post(uploadUrl, fd, {
      headers: {
        "Access-Token": accessToken,
        ...fd.getHeaders(),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 1000 * 60 * 10, // 10 分钟
    });

    return res.status(200).json({ success: true, target, tiktok: resp.data });
  } catch (err) {
    console.error("上传失败：", err.response?.data || err.message);
    return res.status(500).json({
      error: "上传失败",
      details: err.response?.data || err.message,
    });
  }
}
