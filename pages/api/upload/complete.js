// pages/api/upload/complete.js
import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";

export const config = { api: { bodyParser: true, sizeLimit: "10mb" }, runtime: "nodejs" };

const ROOT = path.join(process.cwd(), ".upload_tmp");

async function concatChunks(dir, totalChunks, outPath) {
  return new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(outPath);
    let i = 0;
    function pump() {
      if (i >= totalChunks) return ws.end(() => resolve(true));
      const part = path.join(dir, `${i}.part`);
      if (!fs.existsSync(part)) return reject(new Error(`missing chunk ${i}`));
      const rs = fs.createReadStream(part);
      rs.on("end", () => { i += 1; pump(); });
      rs.on("error", reject);
      rs.pipe(ws, { end: false });
    }
    pump();
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { uploadId, target = "bc" } = req.body || {};
  if (!uploadId) return res.status(400).json({ error: "missing uploadId" });

  const { TT_BUSINESS_CENTER_ID, TT_ADVERTISER_ID, NEXT_PUBLIC_SITE_URL } = process.env;

  try {
    // 1) 读取 manifest，确认是否收齐
    const dir = path.join(ROOT, uploadId);
    const manifestPath = path.join(dir, "manifest.json");
    if (!fs.existsSync(manifestPath)) return res.status(400).json({ error: "invalid uploadId" });

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const chunkDir = path.join(dir, "chunks");

    if (manifest.received.length !== manifest.totalChunks) {
      return res.status(400).json({ error: "not_complete", received: manifest.received.length, total: manifest.totalChunks });
    }

    // 2) 合并分片
    const outPath = path.join(dir, "merged.bin");
    await concatChunks(chunkDir, manifest.totalChunks, outPath);

    // 3) 拿 access_token（沿用你现有 /api/auth）
    const site = NEXT_PUBLIC_SITE_URL || "http://localhost:3001";
    const authRes = await axios.get(`${site}/api/auth`, { timeout: 60000 });
    const accessToken = authRes.data?.access_token;
    if (!accessToken) return res.status(500).json({ error: "get_token_failed" });

    // 4) 组装 TikTok 上传请求（与你现有 upload.js 保持一致）
    const fd = new FormData();
    fd.append("file", fs.createReadStream(outPath), {
      filename: manifest.filename || "video.mp4",
      contentType: "video/mp4",
    });

    let uploadUrl = "";
    if (target === "bc") {
      if (!TT_BUSINESS_CENTER_ID) return res.status(400).json({ error: "missing TT_BUSINESS_CENTER_ID" });
      uploadUrl = "https://business-api.tiktok.com/open_api/v1.3/file/upload/";
      fd.append("business_center_id", TT_BUSINESS_CENTER_ID);
    } else {
      if (!TT_ADVERTISER_ID) return res.status(400).json({ error: "missing TT_ADVERTISER_ID" });
      uploadUrl = "https://business-api.tiktok.com/open_api/v1.3/file/video/ad/upload/";
      fd.append("advertiser_id", TT_ADVERTISER_ID);
      // 可选：fd.append("upload_type","UPLOAD_BY_FILE");
    }

    const resp = await axios.post(uploadUrl, fd, {
      headers: {
        "Access-Token": accessToken,
        ...fd.getHeaders(),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 1000 * 60 * 15, // 15 分钟
    });

    // 5) 清理临时文件（可选）
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {}

    return res.status(200).json({ success: true, target, tiktok: resp.data });
  } catch (e) {
    console.error("complete error:", e.response?.data || e.message);
    return res.status(500).json({ error: "complete_failed", details: e.response?.data || e.message });
  }
}
