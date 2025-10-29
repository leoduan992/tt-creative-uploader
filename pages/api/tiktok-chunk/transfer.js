// pages/api/tiktok-chunk/transfer.js
import axios from "axios";
import formidable from "formidable";
import fs from "fs";
import FormData from "form-data";

export const config = { api: { bodyParser: false, sizeLimit: "20mb" }, runtime: "nodejs" };

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      multiples: false,
      keepExtensions: true,
      maxFileSize: 20 * 1024 * 1024, // 单片 20MB 上限（前端建议 5-10MB）
    });
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { TT_ADVERTISER_ID, NEXT_PUBLIC_SITE_URL } = process.env;
  if (!TT_ADVERTISER_ID) return res.status(400).json({ error: "missing TT_ADVERTISER_ID" });

  try {
    const { fields, files } = await parseForm(req);
    const upload_id = (fields.upload_id || "").toString();
    const start_offset = String(fields.start_offset || "0");
    const signature = (fields.signature || "").toString(); // 整个文件的 MD5
    const chunk = files.chunk;

    if (!upload_id || !chunk || !signature) {
      return res.status(400).json({ error: "missing upload_id/chunk/signature" });
    }

    const site = NEXT_PUBLIC_SITE_URL || "http://localhost:3001";
    const { data: auth } = await axios.get(`${site}/api/auth`, { timeout: 60000 });
    const accessToken = auth?.access_token;
    if (!accessToken) return res.status(500).json({ error: "get_token_failed" });

    const fd = new FormData();
    fd.append("advertiser_id", TT_ADVERTISER_ID);
    fd.append("upload_id", upload_id);
    fd.append("signature", signature);
    fd.append("start_offset", start_offset);
    fd.append("file", fs.createReadStream(chunk.filepath), { filename: chunk.originalFilename || "chunk.bin" });

    const r = await axios.post(
      "https://business-api.tiktok.com/open_api/v1.3/file/transfer/upload/",
      fd,
      {
        headers: { "Access-Token": accessToken, ...fd.getHeaders() },
        timeout: 20000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );

    return res.status(200).json(r.data);
  } catch (e) {
    return res.status(500).json({ error: "transfer_failed", details: e.response?.data || e.message });
  }
}
