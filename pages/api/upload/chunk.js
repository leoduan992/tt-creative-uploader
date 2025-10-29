// pages/api/upload/chunk.js
import fs from "fs";
import path from "path";
import formidable from "formidable";

export const config = {
  api: { bodyParser: false, sizeLimit: "500mb" }, // 单片 500MB 上限（可调）
  runtime: "nodejs",
};

const ROOT = path.join(process.cwd(), ".upload_tmp");

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({ multiples: false, keepExtensions: true, maxFileSize: 1024 * 1024 * 1024 });
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { fields, files } = await parseForm(req);
    const uploadId = (fields.uploadId || "").toString();
    const index = Number(fields.index);
    const totalChunks = Number(fields.totalChunks);
    const file = files.chunk;

    if (!uploadId || Number.isNaN(index) || Number.isNaN(totalChunks) || !file) {
      return res.status(400).json({ error: "missing fields: uploadId/index/totalChunks/chunk" });
    }

    const dir = path.join(ROOT, uploadId);
    const chunkDir = path.join(dir, "chunks");
    const manifestPath = path.join(dir, "manifest.json");
    if (!fs.existsSync(manifestPath)) return res.status(400).json({ error: "invalid uploadId" });

    const dest = path.join(chunkDir, `${index}.part`);
    // 移动/复制分片到目标位置
    fs.copyFileSync(file.filepath, dest);

    // 更新 manifest
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (!manifest.received.includes(index)) manifest.received.push(index);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

    return res.status(200).json({ ok: true, received: manifest.received.length, totalChunks });
  } catch (e) {
    console.error("chunk error:", e);
    return res.status(500).json({ error: "chunk_upload_failed", details: e.message });
  }
}
